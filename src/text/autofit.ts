/**
 * Autofit helpers: rough text size estimation with greedy word wrap, and the
 * shrink factor search used by autofit === 'shrink'.
 *
 * The estimator is intentionally simple and deterministic: character widths
 * come from a per-run metrics function (default: charWidth = size * 0.55,
 * lineHeight = size * 1.2) and the paragraph's lineSpacing multiplies the
 * line height.
 */

import type { Paragraph, Size, TextBody, TextRun } from '../core/types';
import { textRun } from '../core/defaults';
import { round } from '../core/util';
import type { FontMetricsFn, TextMeasurement } from './types';

export const DEFAULT_CHAR_WIDTH_FACTOR = 0.55;
export const DEFAULT_LINE_HEIGHT_FACTOR = 1.2;

export const defaultFontMetrics: FontMetricsFn = (run: TextRun) => ({
  charWidth: run.font.size * DEFAULT_CHAR_WIDTH_FACTOR,
  lineHeight: run.font.size * DEFAULT_LINE_HEIGHT_FACTOR,
});

interface Ch {
  c: string;
  w: number;
  h: number;
}

/** Greedy word wrap of one soft line; returns wrapped line count and extents. */
function wrapChars(
  chars: Ch[],
  avail: number,
  emptyLineHeight: number,
): { lines: number; width: number; height: number } {
  if (chars.length === 0) return { lines: 1, width: 0, height: emptyLineHeight };

  // Tokenize into alternating space/word tokens.
  interface Token {
    isSpace: boolean;
    width: number;
    height: number;
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const isSpace = chars[i].c === ' ';
    let width = 0;
    let height = 0;
    while (i < chars.length && (chars[i].c === ' ') === isSpace) {
      width += chars[i].w;
      height = Math.max(height, chars[i].h);
      i += 1;
    }
    tokens.push({ isSpace, width, height });
  }

  let lines = 1;
  let lineWidth = 0;
  let lineHeight = 0;
  let maxWidth = 0;
  let totalHeight = 0;
  let pendingSpace: Token | null = null;

  const commitLine = () => {
    maxWidth = Math.max(maxWidth, lineWidth);
    totalHeight += lineHeight > 0 ? lineHeight : emptyLineHeight;
    lineWidth = 0;
    lineHeight = 0;
  };

  for (const token of tokens) {
    if (token.isSpace) {
      // Spaces are held pending; dropped if the line wraps at this point.
      pendingSpace = token;
      lineHeight = Math.max(lineHeight, token.height);
      continue;
    }
    const spaceW = pendingSpace ? pendingSpace.width : 0;
    if (lineWidth > 0 && lineWidth + spaceW + token.width > avail) {
      commitLine();
      lines += 1;
      lineWidth = token.width;
      lineHeight = token.height;
    } else {
      lineWidth += spaceW + token.width;
      lineHeight = Math.max(lineHeight, token.height);
    }
    pendingSpace = null;
  }
  if (pendingSpace) lineWidth += pendingSpace.width; // trailing spaces on last line
  commitLine();

  return { lines, width: maxWidth, height: totalHeight };
}

function paragraphSoftLines(p: Paragraph, fontMetrics: FontMetricsFn): Ch[][] {
  const softLines: Ch[][] = [[]];
  for (const child of p.children) {
    if (child.type === 'break') {
      softLines.push([]);
      continue;
    }
    const m = fontMetrics(child);
    const h = m.lineHeight * p.lineSpacing;
    for (const c of child.text) {
      softLines[softLines.length - 1].push({ c, w: m.charWidth, h });
    }
  }
  return softLines;
}

/**
 * Estimate the laid-out size of a body constrained to `boxWidth` (available
 * text width in points). Greedy word wrap; words wider than the box occupy
 * a line of their own (and may overflow the reported width beyond boxWidth).
 */
export function estimateTextSize(
  body: TextBody,
  boxWidth: number,
  fontMetrics: FontMetricsFn = defaultFontMetrics,
): TextMeasurement {
  const avail = body.wordWrap ? Math.max(0, boxWidth) : Number.POSITIVE_INFINITY;
  let width = 0;
  let height = 0;
  let lines = 0;

  for (const p of body.paragraphs) {
    const emptyLineHeight = fontMetrics(textRun('')).lineHeight * p.lineSpacing;
    height += p.spaceBefore;
    for (const soft of paragraphSoftLines(p, fontMetrics)) {
      const r = wrapChars(soft, avail, emptyLineHeight);
      lines += r.lines;
      width = Math.max(width, r.width);
      height += r.height;
    }
    height += p.spaceAfter;
  }

  return { width: round(width), height: round(height), lines };
}

export const SHRINK_MIN = 0.25;
export const SHRINK_STEP = 0.05;

/**
 * Compute the font scale for autofit 'shrink': try 1.0 down to 0.25 in 0.05
 * steps and return the first scale at which the text fits inside `box`
 * (box minus the body's insets). Returns 0.25 if nothing fits.
 */
export function computeShrinkFactor(
  body: TextBody,
  box: Size,
  fontMetrics: FontMetricsFn = defaultFontMetrics,
): number {
  const availW = Math.max(1, box.width - body.insets.left - body.insets.right);
  const availH = Math.max(1, box.height - body.insets.top - body.insets.bottom);
  const EPS = 1e-6;

  for (let steps = 0; steps <= Math.round((1 - SHRINK_MIN) / SHRINK_STEP); steps++) {
    const factor = round((100 - steps * SHRINK_STEP * 100) / 100, 2);
    const scaled: FontMetricsFn = (run) => {
      const m = fontMetrics(run);
      return { charWidth: m.charWidth * factor, lineHeight: m.lineHeight * factor };
    };
    const size = estimateTextSize(body, availW, scaled);
    if (size.height <= availH + EPS && size.width <= availW + EPS) return factor;
  }
  return SHRINK_MIN;
}
