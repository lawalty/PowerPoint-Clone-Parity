/** Reading text out of the model. */

import type { Paragraph, ParagraphChild, TextBody } from '../core/types';

/** Length in characters of a paragraph child (a LineBreak counts as 1). */
export function childLength(child: ParagraphChild): number {
  return child.type === 'break' ? 1 : child.text.length;
}

/** Plain text of a paragraph; line breaks render as '\n'. */
export function getParagraphText(p: Paragraph): string {
  let out = '';
  for (const child of p.children) out += child.type === 'break' ? '\n' : child.text;
  return out;
}

/** Total character length of a paragraph. */
export function paragraphLength(p: Paragraph): number {
  let len = 0;
  for (const child of p.children) len += childLength(child);
  return len;
}

/** Plain text of a whole body; paragraphs joined with '\n'. */
export function getBodyText(body: TextBody): string {
  return body.paragraphs.map(getParagraphText).join('\n');
}
