/**
 * Editing operations. All operations mutate the given TextBody in place and
 * return it (for chaining). Runs are kept normalized after every edit.
 */

import type { Paragraph, TextBody } from '../core/types';
import { paragraphLength } from './read';
import {
  clampPosition,
  inheritFormatAt,
  makeRun,
  normalizeParagraph,
  orderPositions,
  paragraphProps,
  splitChildrenAt,
} from './internal';
import type { TextPosition } from './types';

/**
 * Insert plain text at a position, inheriting formatting from the run
 * at/before the insertion point. '\n' characters split paragraphs.
 */
export function insertText(body: TextBody, pos: TextPosition, text: string): TextBody {
  if (text.length === 0) return body;
  const at = clampPosition(body, pos);
  const p = body.paragraphs[at.paragraphIndex];
  const inherited = inheritFormatAt(p, at.offset);
  const segments = text.split('\n');
  const [left, right] = splitChildrenAt(p.children, at.offset);

  if (segments.length === 1) {
    p.children = [...left, makeRun(segments[0], inherited.font, inherited.hyperlink), ...right];
    normalizeParagraph(p);
    return body;
  }

  // First segment stays in the original paragraph.
  p.children = [...left, makeRun(segments[0], inherited.font, inherited.hyperlink)];
  normalizeParagraph(p);

  const inserted: Paragraph[] = [];
  for (let i = 1; i < segments.length - 1; i++) {
    const np: Paragraph = {
      ...paragraphProps(p),
      children: segments[i].length ? [makeRun(segments[i], inherited.font, inherited.hyperlink)] : [],
    };
    inserted.push(np);
  }

  const lastSeg = segments[segments.length - 1];
  const lastPara: Paragraph = {
    ...paragraphProps(p),
    children: [
      ...(lastSeg.length ? [makeRun(lastSeg, inherited.font, inherited.hyperlink)] : []),
      ...right,
    ],
  };
  normalizeParagraph(lastPara);
  inserted.push(lastPara);

  body.paragraphs.splice(at.paragraphIndex + 1, 0, ...inserted);
  return body;
}

/**
 * Delete the text between two positions. When the range spans paragraph
 * boundaries, the surviving halves of the first and last paragraphs are
 * merged into one paragraph (keeping the first paragraph's properties).
 */
export function deleteRange(body: TextBody, start: TextPosition, end: TextPosition): TextBody {
  const [a, b] = orderPositions(clampPosition(body, start), clampPosition(body, end));
  if (a.paragraphIndex === b.paragraphIndex && a.offset === b.offset) return body;

  if (a.paragraphIndex === b.paragraphIndex) {
    const p = body.paragraphs[a.paragraphIndex];
    const [left, rest] = splitChildrenAt(p.children, a.offset);
    const [, right] = splitChildrenAt(rest, b.offset - a.offset);
    p.children = [...left, ...right];
    normalizeParagraph(p);
    return body;
  }

  const first = body.paragraphs[a.paragraphIndex];
  const last = body.paragraphs[b.paragraphIndex];
  const [left] = splitChildrenAt(first.children, a.offset);
  const [, right] = splitChildrenAt(last.children, b.offset);
  first.children = [...left, ...right];
  normalizeParagraph(first);
  body.paragraphs.splice(a.paragraphIndex + 1, b.paragraphIndex - a.paragraphIndex);
  return body;
}

/** Split a paragraph at a position (the Enter key). */
export function splitParagraph(body: TextBody, pos: TextPosition): TextBody {
  const at = clampPosition(body, pos);
  const p = body.paragraphs[at.paragraphIndex];
  const [left, right] = splitChildrenAt(p.children, at.offset);
  p.children = left;
  normalizeParagraph(p);
  const np: Paragraph = { ...paragraphProps(p), children: right };
  normalizeParagraph(np);
  body.paragraphs.splice(at.paragraphIndex + 1, 0, np);
  return body;
}

/**
 * Merge a paragraph into the previous one (Backspace at paragraph start).
 * No-op for the first paragraph or out-of-range indices.
 */
export function mergeWithPrevious(body: TextBody, paragraphIndex: number): TextBody {
  if (paragraphIndex <= 0 || paragraphIndex >= body.paragraphs.length) return body;
  const prev = body.paragraphs[paragraphIndex - 1];
  const cur = body.paragraphs[paragraphIndex];
  prev.children = [...prev.children, ...cur.children];
  normalizeParagraph(prev);
  body.paragraphs.splice(paragraphIndex, 1);
  return body;
}

/** Position at the very end of a body (after the last paragraph's text). */
export function endOfBody(body: TextBody): TextPosition {
  const paragraphIndex = Math.max(0, body.paragraphs.length - 1);
  const p = body.paragraphs[paragraphIndex];
  return { paragraphIndex, offset: p ? paragraphLength(p) : 0 };
}
