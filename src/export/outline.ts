/**
 * Plain-text outline export: slide numbers, title placeholder text and body
 * bullet lines.
 */

import type { Presentation, SlideElement, TextBody } from '../core/types';
import { getBodyText, getParagraphText } from '../text';

function textBodyOf(el: SlideElement): TextBody | undefined {
  if (el.type === 'shape' || el.type === 'textbox') {
    return el.textBody;
  }
  return undefined;
}

function isTitleKind(kind: string): boolean {
  return kind === 'title' || kind === 'centeredTitle';
}

function isBodyKind(kind: string): boolean {
  return kind === 'body' || kind === 'content' || kind === 'subtitle';
}

/**
 * Build a plain-text outline: one "N. Title" line per slide followed by an
 * indented "- text" line per non-empty body placeholder paragraph.
 */
export function exportOutlineText(pres: Presentation): string {
  const lines: string[] = [];
  pres.slides.forEach((slide, i) => {
    let title = '';
    const bodyLines: string[] = [];
    for (const el of slide.elements) {
      const kind = el.placeholder?.kind;
      const body = textBodyOf(el);
      if (!kind || !body) {
        continue;
      }
      if (isTitleKind(kind) && !title) {
        title = getBodyText(body).replace(/\n+/g, ' ').trim();
      } else if (isBodyKind(kind)) {
        for (const p of body.paragraphs) {
          const text = getParagraphText(p).trim();
          if (text) {
            bodyLines.push(`  - ${text}`);
          }
        }
      }
    }
    lines.push(`${i + 1}. ${title}`.trimEnd());
    lines.push(...bodyLines);
  });
  return lines.join('\n');
}
