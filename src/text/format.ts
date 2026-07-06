/** Character-level formatting. Operations mutate the body in place. */

import type { FontRef, TextBody } from '../core/types';
import {
  clampPosition,
  deepEqual,
  forEachRunInRange,
  inheritFormatAt,
  mutateBodyRange,
} from './internal';
import type { TextPosition, ToggleableFormatKey } from './types';

/** Merge a patch into a font, ignoring undefined values (except highlight,
 * where an explicit undefined clears the highlight). */
function applyFontPatch(font: FontRef, patch: Partial<FontRef>): FontRef {
  const out: FontRef = { ...font };
  for (const key of Object.keys(patch) as (keyof FontRef)[]) {
    const value = patch[key];
    if (value === undefined) {
      if (key === 'highlight') delete out.highlight;
      continue;
    }
    (out as Record<keyof FontRef, unknown>)[key] = value;
  }
  return out;
}

/**
 * Apply a character format patch exactly to [start, end), splitting runs at
 * the range boundaries as needed.
 */
export function applyCharFormat(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
  patch: Partial<FontRef>,
): TextBody {
  mutateBodyRange(body, start, end, (run) => {
    run.font = applyFontPatch(run.font, patch);
  });
  return body;
}

/**
 * The common value of `key` across every run overlapping the range, or
 * undefined when the range is empty or the values differ.
 */
export function rangeHasUniformFormat<K extends keyof FontRef>(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
  key: K,
): FontRef[K] | undefined {
  let seen = false;
  let uniform = true;
  let value: FontRef[K] | undefined;
  forEachRunInRange(body, start, end, (run) => {
    if (!seen) {
      seen = true;
      value = run.font[key];
    } else if (uniform && !deepEqual(value, run.font[key])) {
      uniform = false;
    }
  });
  return seen && uniform ? value : undefined;
}

/**
 * PowerPoint toggle semantics: if the entire range already has the attribute,
 * remove it; otherwise apply it to the whole range.
 */
export function toggleFormat(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
  key: ToggleableFormatKey,
): TextBody {
  const allOn = rangeHasUniformFormat(body, start, end, key) === true;
  return applyCharFormat(body, start, end, { [key]: !allOn } as Partial<FontRef>);
}

/** FontRef of the run before/at the position (what typing there would use). */
export function getFormatAt(body: TextBody, pos: TextPosition): FontRef {
  const at = clampPosition(body, pos);
  return inheritFormatAt(body.paragraphs[at.paragraphIndex], at.offset).font;
}
