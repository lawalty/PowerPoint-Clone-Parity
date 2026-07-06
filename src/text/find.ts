/** Find & replace over text bodies. */

import type { TextBody } from '../core/types';
import { getParagraphText } from './read';
import { formatAtChar, makeRun, normalizeParagraph, splitChildrenAt } from './internal';
import type { BodySource, FindMatch, FindOptions, TaggedFindMatch } from './types';

const WORD_CHAR = /[A-Za-z0-9_]/;

function isWordBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return true;
  return !WORD_CHAR.test(text[index]);
}

/** Non-overlapping matches of `query` within a single string. */
function findInText(text: string, query: string, opts: FindOptions): { start: number; end: number }[] {
  if (query.length === 0) return [];
  const hay = opts.matchCase ? text : text.toLowerCase();
  const needle = opts.matchCase ? query : query.toLowerCase();
  const matches: { start: number; end: number }[] = [];
  let i = 0;
  while (i <= hay.length - needle.length) {
    const found = hay.indexOf(needle, i);
    if (found === -1) break;
    const end = found + needle.length;
    if (!opts.wholeWord || (isWordBoundary(text, found - 1) && isWordBoundary(text, end))) {
      matches.push({ start: found, end });
      i = end;
    } else {
      i = found + 1;
    }
  }
  return matches;
}

/**
 * Find all matches of `query` in a body. Offsets are paragraph-local; line
 * breaks match '\n'. Matches never span paragraph boundaries.
 */
export function findInBody(body: TextBody, query: string, opts: FindOptions = {}): FindMatch[] {
  const out: FindMatch[] = [];
  body.paragraphs.forEach((p, paragraphIndex) => {
    for (const m of findInText(getParagraphText(p), query, opts)) {
      out.push({ paragraphIndex, start: m.start, end: m.end });
    }
  });
  return out;
}

/**
 * Replace all matches of `query` with `replacement`, preserving the
 * formatting (font and hyperlink) of the first character of each match.
 * Returns the number of replacements made. Mutates the body in place.
 */
export function replaceInBody(
  body: TextBody,
  query: string,
  replacement: string,
  opts: FindOptions = {},
): number {
  const matches = findInBody(body, query, opts);
  // Process from the last match backwards so earlier offsets stay valid.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const p = body.paragraphs[m.paragraphIndex];
    const fmt = formatAtChar(p, m.start);
    const [left, rest] = splitChildrenAt(p.children, m.start);
    const [, right] = splitChildrenAt(rest, m.end - m.start);
    p.children = [
      ...left,
      ...(replacement.length ? [makeRun(replacement, fmt.font, fmt.hyperlink)] : []),
      ...right,
    ];
    normalizeParagraph(p);
  }
  return matches.length;
}

/** Search multiple elements' bodies, tagging matches with their element id. */
export function findInBodies(
  sources: BodySource[],
  query: string,
  opts: FindOptions = {},
): TaggedFindMatch[] {
  const out: TaggedFindMatch[] = [];
  for (const { elementId, body } of sources) {
    for (const m of findInBody(body, query, opts)) {
      out.push({ elementId, ...m });
    }
  }
  return out;
}
