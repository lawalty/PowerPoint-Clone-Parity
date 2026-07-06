/** Paragraph-level formatting. Operations mutate the body in place. */

import type { TextAlign, TextBody } from '../core/types';
import { paragraphsInRange } from './internal';
import type { ParagraphFormatPatch } from './types';

/**
 * Apply a paragraph format patch to every paragraph in the inclusive index
 * range [fromIdx, toIdx]. Undefined patch values are ignored; children are
 * never touched.
 */
export function applyParagraphFormat(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  patch: ParagraphFormatPatch,
): TextBody {
  for (const p of paragraphsInRange(body, fromIdx, toIdx)) {
    for (const key of Object.keys(patch) as (keyof ParagraphFormatPatch)[]) {
      const value = patch[key];
      if (value === undefined) continue;
      (p as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return body;
}

export function setAlignment(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  align: TextAlign,
): TextBody {
  return applyParagraphFormat(body, fromIdx, toIdx, { align });
}

export function setLineSpacing(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  lineSpacing: number,
): TextBody {
  return applyParagraphFormat(body, fromIdx, toIdx, { lineSpacing });
}

export function setSpaceBefore(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  spaceBefore: number,
): TextBody {
  return applyParagraphFormat(body, fromIdx, toIdx, { spaceBefore });
}

export function setSpaceAfter(
  body: TextBody,
  fromIdx: number,
  toIdx: number,
  spaceAfter: number,
): TextBody {
  return applyParagraphFormat(body, fromIdx, toIdx, { spaceAfter });
}
