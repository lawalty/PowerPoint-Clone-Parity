/**
 * Snapshot-based mutation commands. A mutation captures before/after state of
 * a scoped sub-object (e.g. one slide) via deepClone and restores IN PLACE so
 * external references to the object graph stay valid.
 */

import type { Id, Presentation, Slide } from '../core/types';
import { deepClone } from '../core/util';
import type { Command } from './history';

export interface MutationScope<T, S> {
  /** Capture a serializable snapshot of the target's relevant state. */
  snapshot(target: T): S;
  /** Restore a snapshot into the target, mutating it in place. */
  restore(target: T, state: S): void;
}

/**
 * Restore `state` into `target` by mutating the existing object graph:
 * arrays are spliced in place and object properties reassigned, so any
 * external references to `target` (or nested objects that persist across
 * the snapshot) remain valid.
 */
export function restoreInPlace(target: unknown, state: unknown): void {
  if (Array.isArray(target) && Array.isArray(state)) {
    target.splice(0, target.length, ...(deepClone(state) as unknown[]));
    return;
  }
  if (
    typeof target !== 'object' ||
    target === null ||
    typeof state !== 'object' ||
    state === null
  ) {
    throw new Error('restoreInPlace requires matching object/array targets');
  }
  const t = target as Record<string, unknown>;
  const s = state as Record<string, unknown>;
  for (const key of Object.keys(t)) {
    if (!(key in s)) delete t[key];
  }
  for (const key of Object.keys(s)) {
    const sv = s[key];
    const tv = t[key];
    if (
      sv !== null &&
      tv !== null &&
      typeof sv === 'object' &&
      typeof tv === 'object' &&
      Array.isArray(sv) === Array.isArray(tv)
    ) {
      restoreInPlace(tv, sv);
    } else {
      t[key] = deepClone(sv);
    }
  }
}

/**
 * Create a command that runs `mutate(target)` and captures before/after
 * snapshots of the (optionally scoped) target for undo/redo. The default
 * scope deep-clones the whole target and restores it in place.
 */
export function makeMutation<T extends object, S = T>(
  label: string,
  target: T,
  mutate: (t: T) => void,
  scope?: Partial<MutationScope<T, S>>,
): Command {
  const snapshot: (t: T) => S =
    scope?.snapshot ?? ((t: T) => deepClone(t) as unknown as S);
  const restore: (t: T, s: S) => void =
    scope?.restore ?? ((t: T, s: S) => restoreInPlace(t, s));

  let before: S | undefined;
  let after: S | undefined;
  let captured = false;

  return {
    label,
    execute(): void {
      if (!captured) {
        before = snapshot(target);
        mutate(target);
        after = snapshot(target);
        captured = true;
      } else {
        restore(target, after as S);
      }
    },
    undo(): void {
      restore(target, before as S);
    },
  };
}

/** Mutation command scoped to a single slide of the presentation. */
export function slideMutation(
  pres: Presentation,
  slideId: Id,
  label: string,
  fn: (slide: Slide) => void,
): Command {
  const slide = pres.slides.find((s) => s.id === slideId);
  if (!slide) throw new Error(`slideMutation: slide not found: ${slideId}`);
  return makeMutation(label, slide, fn);
}

/** Mutation command scoped to the whole presentation. */
export function presentationMutation(
  pres: Presentation,
  label: string,
  fn: (pres: Presentation) => void,
): Command {
  return makeMutation(label, pres, fn);
}
