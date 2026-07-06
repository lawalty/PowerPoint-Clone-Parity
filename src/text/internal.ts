/**
 * Internal helpers shared by the text engine modules.
 * Not re-exported from src/text/index.ts except where noted.
 */

import type { FontRef, Paragraph, ParagraphChild, TextBody, TextRun } from '../core/types';
import { defaultFont } from '../core/defaults';
import { clamp, deepClone } from '../core/util';
import { childLength, paragraphLength } from './read';
import type { TextPosition } from './types';

/** Structural deep equality for plain serializable data; undefined values are ignored. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return false;
  const rec = (o: object): Record<string, unknown> => o as Record<string, unknown>;
  const ka = Object.keys(a).filter((k) => rec(a)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => rec(b)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(rec(a)[k], rec(b)[k]));
}

/** Two runs can be merged when both font and hyperlink match. */
export function runsMergeable(a: TextRun, b: TextRun): boolean {
  return a.hyperlink === b.hyperlink && deepEqual(a.font, b.font);
}

/** Build a run with a cloned font so pieces never alias each other. */
export function makeRun(text: string, font: FontRef, hyperlink?: string): TextRun {
  const run: TextRun = { type: 'run', text, font: deepClone(font) };
  if (hyperlink !== undefined) run.hyperlink = hyperlink;
  return run;
}

/**
 * Normalize a paragraph in place: drop empty runs and merge adjacent runs
 * with identical formatting. A paragraph may end up with zero children.
 */
export function normalizeParagraph(p: Paragraph): void {
  const out: ParagraphChild[] = [];
  for (const child of p.children) {
    if (child.type === 'run' && child.text === '') continue;
    const prev = out[out.length - 1];
    if (child.type === 'run' && prev && prev.type === 'run' && runsMergeable(prev, child)) {
      out[out.length - 1] = { ...prev, text: prev.text + child.text };
    } else {
      out.push(child);
    }
  }
  p.children = out;
}

/**
 * Split a child list at a character offset, cutting a run in two when the
 * offset falls inside it. Breaks are atomic (length 1) and never straddle.
 */
export function splitChildrenAt(
  children: ParagraphChild[],
  offset: number,
): [ParagraphChild[], ParagraphChild[]] {
  const left: ParagraphChild[] = [];
  const right: ParagraphChild[] = [];
  let pos = 0;
  for (const child of children) {
    const len = childLength(child);
    if (pos + len <= offset) {
      left.push(child);
    } else if (pos >= offset) {
      right.push(child);
    } else {
      const run = child as TextRun;
      const cut = offset - pos;
      left.push(makeRun(run.text.slice(0, cut), run.font, run.hyperlink));
      right.push(makeRun(run.text.slice(cut), run.font, run.hyperlink));
    }
    pos += len;
  }
  return [left, right];
}

/** All paragraph properties except children (bullet deep-cloned). */
export function paragraphProps(p: Paragraph): Omit<Paragraph, 'children'> {
  return {
    align: p.align,
    level: p.level,
    bullet: deepClone(p.bullet),
    lineSpacing: p.lineSpacing,
    spaceBefore: p.spaceBefore,
    spaceAfter: p.spaceAfter,
    indent: p.indent,
  };
}

/** Clamp a position to valid paragraph index / offset within the body. */
export function clampPosition(body: TextBody, pos: TextPosition): TextPosition {
  const paragraphIndex = clamp(pos.paragraphIndex, 0, Math.max(0, body.paragraphs.length - 1));
  const p = body.paragraphs[paragraphIndex];
  const offset = clamp(pos.offset, 0, p ? paragraphLength(p) : 0);
  return { paragraphIndex, offset };
}

/** Order two positions so the first is not after the second. */
export function orderPositions(a: TextPosition, b: TextPosition): [TextPosition, TextPosition] {
  if (
    a.paragraphIndex > b.paragraphIndex ||
    (a.paragraphIndex === b.paragraphIndex && a.offset > b.offset)
  ) {
    return [b, a];
  }
  return [a, b];
}

/**
 * Formatting to inherit for text typed at `offset` in paragraph `p`:
 * the run containing the position (interior positions also inherit the
 * hyperlink), else the run ending at the offset, else the next run,
 * else the model default font.
 */
export function inheritFormatAt(
  p: Paragraph,
  offset: number,
): { font: FontRef; hyperlink?: string } {
  let pos = 0;
  let before: TextRun | undefined;
  let after: TextRun | undefined;
  for (const child of p.children) {
    const len = childLength(child);
    const end = pos + len;
    if (child.type === 'run') {
      if (offset > pos && offset < end) {
        return { font: deepClone(child.font), hyperlink: child.hyperlink };
      }
      if (end <= offset) before = child;
      if (pos >= offset && !after) after = child;
    }
    pos = end;
  }
  const src = before ?? after;
  return { font: src ? deepClone(src.font) : defaultFont() };
}

/** Formatting of the character at `offset` (falls back to inheritFormatAt). */
export function formatAtChar(
  p: Paragraph,
  offset: number,
): { font: FontRef; hyperlink?: string } {
  let pos = 0;
  for (const child of p.children) {
    const end = pos + childLength(child);
    if (offset >= pos && offset < end && child.type === 'run') {
      return { font: deepClone(child.font), hyperlink: child.hyperlink };
    }
    pos = end;
  }
  return inheritFormatAt(p, offset);
}

/**
 * Split runs so [start, end) covers whole runs in paragraph `p`, apply
 * `mutate` to each run inside, then re-normalize.
 */
export function patchParagraphRange(
  p: Paragraph,
  start: number,
  end: number,
  mutate: (run: TextRun) => void,
): void {
  const len = paragraphLength(p);
  const s = clamp(start, 0, len);
  const e = clamp(end, 0, len);
  if (e <= s) return;
  const [left, rest] = splitChildrenAt(p.children, s);
  const [mid, right] = splitChildrenAt(rest, e - s);
  for (const c of mid) if (c.type === 'run') mutate(c);
  p.children = [...left, ...mid, ...right];
  normalizeParagraph(p);
}

/** Visit every run overlapping the (ordered, clamped) range. */
export function forEachRunInRange(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
  fn: (run: TextRun, paragraphIndex: number) => void,
): void {
  const [a, b] = orderPositions(clampPosition(body, start), clampPosition(body, end));
  for (let pi = a.paragraphIndex; pi <= b.paragraphIndex; pi++) {
    const p = body.paragraphs[pi];
    const s = pi === a.paragraphIndex ? a.offset : 0;
    const e = pi === b.paragraphIndex ? b.offset : paragraphLength(p);
    let pos = 0;
    for (const child of p.children) {
      const cEnd = pos + childLength(child);
      if (child.type === 'run' && cEnd > s && pos < e) fn(child, pi);
      pos = cEnd;
    }
  }
}

/**
 * Apply `mutate` to every run in the body range, splitting runs at the
 * range boundaries so the change applies exactly to [start, end).
 */
export function mutateBodyRange(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
  mutate: (run: TextRun) => void,
): void {
  const [a, b] = orderPositions(clampPosition(body, start), clampPosition(body, end));
  for (let pi = a.paragraphIndex; pi <= b.paragraphIndex; pi++) {
    const p = body.paragraphs[pi];
    const s = pi === a.paragraphIndex ? a.offset : 0;
    const e = pi === b.paragraphIndex ? b.offset : paragraphLength(p);
    patchParagraphRange(p, s, e, mutate);
  }
}

/** Paragraphs in the inclusive, clamped index range [from, to]. */
export function paragraphsInRange(body: TextBody, from: number, to: number): Paragraph[] {
  const last = Math.max(0, body.paragraphs.length - 1);
  const a = clamp(Math.min(from, to), 0, last);
  const b = clamp(Math.max(from, to), 0, last);
  return body.paragraphs.slice(a, b + 1);
}
