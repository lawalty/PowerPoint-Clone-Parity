/**
 * Speaker notes as plain text over the notes TextBody.
 */

import type { Id, Presentation } from '../core/types';
import { defaultTextBody, paragraphOf } from '../core/defaults';
import { getSlide } from './lookup';

/**
 * The notes of a slide flattened to plain text: paragraphs are joined with
 * '\n', and explicit line breaks inside a paragraph also become '\n'.
 */
export function getNotesText(pres: Presentation, slideId: Id): string {
  const slide = getSlide(pres, slideId);
  return slide.notes.paragraphs
    .map((p) => p.children.map((c) => (c.type === 'run' ? c.text : '\n')).join(''))
    .join('\n');
}

/** Replace the slide's notes with plain text (one paragraph per line). */
export function setNotesText(pres: Presentation, slideId: Id, text: string): void {
  const slide = getSlide(pres, slideId);
  slide.notes = defaultTextBody({
    paragraphs: text.split('\n').map((line) => paragraphOf(line)),
  });
}
