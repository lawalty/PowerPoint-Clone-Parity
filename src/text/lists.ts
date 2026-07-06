/** List (bullet/number) operations and bullet label rendering. */

import type { BulletNumbered, TextBody } from '../core/types';
import { clamp } from '../core/util';
import { paragraphsInRange } from './internal';

export const MIN_LIST_LEVEL = 0;
export const MAX_LIST_LEVEL = 8;

/**
 * Toggle a character bullet on the paragraphs [fromIdx, toIdx]. If every
 * paragraph in the range already has a char bullet, bullets are removed;
 * otherwise all paragraphs get the char bullet.
 */
export function toggleBulletList(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  char = '•',
): TextBody {
  const paras = paragraphsInRange(body, fromIdx, toIdx);
  const allBulleted = paras.every((p) => p.bullet.type === 'char');
  for (const p of paras) {
    p.bullet = allBulleted ? { type: 'none' } : { type: 'char', char };
  }
  return body;
}

/**
 * Toggle a numbered list on the paragraphs [fromIdx, toIdx]. If every
 * paragraph already has a numbered bullet with this format, numbering is
 * removed; otherwise all paragraphs get the numbered bullet.
 */
export function toggleNumberedList(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  format: BulletNumbered['format'] = 'arabicPeriod',
): TextBody {
  const paras = paragraphsInRange(body, fromIdx, toIdx);
  const allNumbered = paras.every(
    (p) => p.bullet.type === 'number' && p.bullet.format === format,
  );
  for (const p of paras) {
    p.bullet = allNumbered ? { type: 'none' } : { type: 'number', format, startAt: 1 };
  }
  return body;
}

/** Increase indent level of paragraphs [fromIdx, toIdx], clamped to 0..8. */
export function indent(body: TextBody, fromIdx: number, toIdx: number): TextBody {
  for (const p of paragraphsInRange(body, fromIdx, toIdx)) {
    p.level = clamp(p.level + 1, MIN_LIST_LEVEL, MAX_LIST_LEVEL);
  }
  return body;
}

/** Decrease indent level of paragraphs [fromIdx, toIdx], clamped to 0..8. */
export function outdent(body: TextBody, fromIdx: number, toIdx: number): TextBody {
  for (const p of paragraphsInRange(body, fromIdx, toIdx)) {
    p.level = clamp(p.level - 1, MIN_LIST_LEVEL, MAX_LIST_LEVEL);
  }
  return body;
}

const ROMAN_PAIRS: readonly [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

/** Lowercase roman numeral for n >= 1 (subtractive notation: 4 -> 'iv'). */
export function toRoman(n: number): string {
  let value = Math.max(1, Math.floor(n));
  let out = '';
  for (const [num, sym] of ROMAN_PAIRS) {
    while (value >= num) {
      out += sym;
      value -= num;
    }
  }
  return out;
}

/** Lowercase bijective base-26 alpha label: 1 -> 'a', 26 -> 'z', 27 -> 'aa'. */
export function toAlpha(n: number): string {
  let value = Math.max(1, Math.floor(n));
  let out = '';
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(97 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

/**
 * Render the visible label for the `ordinal`-th item (1-based) of a numbered
 * list, honoring the bullet's startAt.
 */
export function bulletLabel(bullet: BulletNumbered, ordinal: number): string {
  const n = Math.max(1, bullet.startAt + ordinal - 1);
  switch (bullet.format) {
    case 'arabicPeriod':
      return `${n}.`;
    case 'arabicParen':
      return `${n})`;
    case 'romanLcPeriod':
      return `${toRoman(n)}.`;
    case 'romanUcPeriod':
      return `${toRoman(n).toUpperCase()}.`;
    case 'alphaLcPeriod':
      return `${toAlpha(n)}.`;
    case 'alphaUcPeriod':
      return `${toAlpha(n).toUpperCase()}.`;
    case 'alphaLcParen':
      return `(${toAlpha(n)})`;
  }
}
