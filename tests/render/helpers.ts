/**
 * Shared fixtures and a lightweight XML well-formedness checker for the
 * render/export test suites.
 */

import type { Presentation, Slide, SlideElement } from '../../src/core/types';
import { resetIds } from '../../src/core/util';
import { addSlide, createPresentation, findLayoutByKind } from '../../src/model';

/** Fresh presentation with deterministic ids and timestamps. */
export function newPres(title = 'Test Deck'): Presentation {
  resetIds();
  return createPresentation({ title, author: 'Tester', now: () => 1_000 });
}

/** Append a blank-layout slide (no placeholders) to the presentation. */
export function blankSlide(pres: Presentation): Slide {
  const blank = findLayoutByKind(pres.layouts, 'blank');
  if (!blank) {
    throw new Error('blank layout missing');
  }
  return addSlide(pres, blank.id);
}

/** Blank slide pre-populated with the given elements. */
export function slideWith(pres: Presentation, ...elements: SlideElement[]): Slide {
  const slide = blankSlide(pres);
  slide.elements.push(...elements);
  return slide;
}

const ENTITY_RE = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;

function hasRawAmp(text: string): boolean {
  return text.replace(ENTITY_RE, '').includes('&');
}

/**
 * Stack-based XML well-formedness check: balanced tags, no stray angle
 * brackets and no unescaped ampersands in text or attribute values.
 * Returns an error description, or null when the document is well-formed.
 */
export function wellFormedError(xml: string): string | null {
  const tagRe = /<\/?([A-Za-z][\w.:-]*)((?:"[^"]*"|'[^']*'|[^"'<>])*)>/g;
  const stack: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml)) !== null) {
    const between = xml.slice(lastIndex, m.index);
    if (between.includes('<') || between.includes('>')) {
      return `stray angle bracket in text near "${between.slice(0, 60)}"`;
    }
    if (hasRawAmp(between)) {
      return `unescaped & in text near "${between.slice(0, 60)}"`;
    }
    if (hasRawAmp(m[2])) {
      return `unescaped & in attributes of <${m[1]}>`;
    }
    lastIndex = tagRe.lastIndex;
    if (m[0].startsWith('</')) {
      const open = stack.pop();
      if (open !== m[1]) {
        return `mismatched </${m[1]}>, expected </${open ?? 'nothing'}>`;
      }
    } else if (!m[0].endsWith('/>')) {
      stack.push(m[1]);
    }
  }
  const tail = xml.slice(lastIndex);
  if (tail.includes('<') || tail.includes('>')) {
    return 'stray angle bracket after the last tag';
  }
  if (stack.length > 0) {
    return `unclosed tags: ${stack.join(', ')}`;
  }
  return null;
}
