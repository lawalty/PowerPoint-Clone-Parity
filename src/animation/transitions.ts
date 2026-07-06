/**
 * Slide transition catalog, validation and editing operations.
 */

import type { Presentation, Slide, Transition, TransitionKind } from '../core/types';
import { deepClone } from '../core/util';

/** All direction values the Transition model supports. */
export type TransitionDirection = NonNullable<Transition['direction']>;

export interface TransitionMeta {
  kind: TransitionKind;
  /** Human-readable name shown in the transitions gallery. */
  label: string;
  /** Direction values valid for this kind; empty = the kind takes no direction. */
  supportsDirection: TransitionDirection[];
  /** Default duration in milliseconds. */
  defaultDuration: number;
}

const CATALOG: Record<TransitionKind, TransitionMeta> = {
  none: { kind: 'none', label: 'None', supportsDirection: [], defaultDuration: 0 },
  fade: { kind: 'fade', label: 'Fade', supportsDirection: [], defaultDuration: 700 },
  push: {
    kind: 'push',
    label: 'Push',
    supportsDirection: ['left', 'right', 'up', 'down'],
    defaultDuration: 500,
  },
  wipe: {
    kind: 'wipe',
    label: 'Wipe',
    supportsDirection: ['left', 'right', 'up', 'down'],
    defaultDuration: 1000,
  },
  split: {
    kind: 'split',
    label: 'Split',
    supportsDirection: ['horizontal', 'vertical', 'in', 'out'],
    defaultDuration: 1000,
  },
  reveal: {
    kind: 'reveal',
    label: 'Reveal',
    supportsDirection: ['left', 'right'],
    defaultDuration: 1300,
  },
  cut: { kind: 'cut', label: 'Cut', supportsDirection: [], defaultDuration: 0 },
  random: { kind: 'random', label: 'Random', supportsDirection: [], defaultDuration: 1000 },
  shape: { kind: 'shape', label: 'Shape', supportsDirection: ['in', 'out'], defaultDuration: 1000 },
  uncover: {
    kind: 'uncover',
    label: 'Uncover',
    supportsDirection: ['left', 'right', 'up', 'down'],
    defaultDuration: 500,
  },
  cover: {
    kind: 'cover',
    label: 'Cover',
    supportsDirection: ['left', 'right', 'up', 'down'],
    defaultDuration: 500,
  },
  flash: { kind: 'flash', label: 'Flash', supportsDirection: [], defaultDuration: 700 },
  dissolve: { kind: 'dissolve', label: 'Dissolve', supportsDirection: [], defaultDuration: 1000 },
  checkerboard: {
    kind: 'checkerboard',
    label: 'Checkerboard',
    supportsDirection: ['left', 'up'],
    defaultDuration: 1000,
  },
  blinds: {
    kind: 'blinds',
    label: 'Blinds',
    supportsDirection: ['horizontal', 'vertical'],
    defaultDuration: 1000,
  },
  zoom: { kind: 'zoom', label: 'Zoom', supportsDirection: ['in', 'out'], defaultDuration: 1000 },
  morph: { kind: 'morph', label: 'Morph', supportsDirection: [], defaultDuration: 750 },
};

/** Kinds that are instantaneous and therefore allow a duration of 0. */
const ZERO_DURATION_KINDS: ReadonlySet<TransitionKind> = new Set(['none', 'cut']);

/** Metadata for every TransitionKind in the model. */
export function transitionCatalog(): TransitionMeta[] {
  return Object.values(CATALOG).map((meta) => ({
    ...meta,
    supportsDirection: [...meta.supportsDirection],
  }));
}

/** Metadata for a single transition kind. */
export function transitionMeta(kind: TransitionKind): TransitionMeta {
  const meta = CATALOG[kind];
  if (!meta) throw new Error(`Unknown transition kind: ${String(kind)}`);
  return { ...meta, supportsDirection: [...meta.supportsDirection] };
}

/**
 * Validate a transition. Throws on an unknown kind, a direction that the kind
 * does not support, or a non-positive duration (kinds 'none' and 'cut' allow 0).
 */
export function validateTransition(t: Transition): void {
  const meta = CATALOG[t.kind];
  if (!meta) throw new Error(`Unknown transition kind: ${String(t.kind)}`);

  if (!Number.isFinite(t.duration)) {
    throw new Error(`Transition duration must be a finite number, got ${t.duration}`);
  }
  const allowZero = ZERO_DURATION_KINDS.has(t.kind);
  if (t.duration < 0 || (t.duration === 0 && !allowZero)) {
    throw new Error(
      `Transition duration must be positive for kind '${t.kind}' (got ${t.duration})`,
    );
  }

  if (t.direction !== undefined && !meta.supportsDirection.includes(t.direction)) {
    throw new Error(`Transition kind '${t.kind}' does not support direction '${t.direction}'`);
  }

  if (t.advanceAfter !== undefined && (!Number.isFinite(t.advanceAfter) || t.advanceAfter < 0)) {
    throw new Error(`Transition advanceAfter must be a non-negative number, got ${t.advanceAfter}`);
  }
}

/**
 * Merge a patch into the slide's transition. Validates the result before
 * applying; on failure the slide is left untouched. Returns the new transition.
 */
export function setTransition(slide: Slide, patch: Partial<Transition>): Transition {
  const next: Transition = { ...slide.transition, ...patch };
  validateTransition(next);
  slide.transition = next;
  return next;
}

/** Apply one transition to every slide (each slide gets its own deep clone). */
export function applyTransitionToAll(presentation: Presentation, transition: Transition): void {
  validateTransition(transition);
  for (const slide of presentation.slides) {
    slide.transition = deepClone(transition);
  }
}
