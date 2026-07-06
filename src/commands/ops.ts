/**
 * High-level editor operations combining History + model mutations. These are
 * self-contained (no imports from other feature modules); each op runs a
 * fully undoable/redoable command through the given History and returns the
 * created undo label.
 */

import type { Fill, Id, Presentation, Slide, SlideElement } from '../core/types';
import type { History } from './history';
import { makeMutation } from './mutate';
import { cloneElementWithNewIds } from './clipboard';

const DUPLICATE_OFFSET = 12;

/** Delete the given elements (and any animations targeting them). */
export function deleteElementsOp(history: History, slide: Slide, ids: Id[]): string {
  const idSet = new Set(ids);
  const label = ids.length === 1 ? 'Delete Element' : `Delete ${ids.length} Elements`;
  const cmd = makeMutation(label, slide, (s) => {
    for (let i = s.elements.length - 1; i >= 0; i--) {
      if (idSet.has(s.elements[i].id)) s.elements.splice(i, 1);
    }
    for (let i = s.animations.length - 1; i >= 0; i--) {
      if (idSet.has(s.animations[i].targetElementId)) s.animations.splice(i, 1);
    }
  });
  history.run(cmd);
  return label;
}

/** Append an element to the slide. */
export function addElementOp(history: History, slide: Slide, element: SlideElement): string {
  const label = `Add ${element.type === 'textbox' ? 'Text Box' : capitalize(element.type)}`;
  const cmd = makeMutation(label, slide, (s) => {
    s.elements.push(element);
  });
  history.run(cmd);
  return label;
}

/** Duplicate the given elements with new ids, offset by +12,+12. */
export function duplicateElementsOp(history: History, slide: Slide, ids: Id[]): string {
  const idSet = new Set(ids);
  const label = ids.length === 1 ? 'Duplicate Element' : `Duplicate ${ids.length} Elements`;
  const cmd = makeMutation(label, slide, (s) => {
    const sources = s.elements.filter((el) => idSet.has(el.id));
    for (const source of sources) {
      const clone = cloneElementWithNewIds(source);
      clone.transform.x += DUPLICATE_OFFSET;
      clone.transform.y += DUPLICATE_OFFSET;
      s.elements.push(clone);
    }
  });
  history.run(cmd);
  return label;
}

/** Move the slide at index `from` to index `to`. */
export function reorderSlideOp(
  history: History,
  pres: Presentation,
  from: number,
  to: number,
): string {
  if (
    from < 0 ||
    from >= pres.slides.length ||
    to < 0 ||
    to >= pres.slides.length
  ) {
    throw new Error(`reorderSlideOp: index out of range (from=${from}, to=${to})`);
  }
  const label = 'Move Slide';
  history.run({
    label,
    execute(): void {
      const [slide] = pres.slides.splice(from, 1);
      pres.slides.splice(to, 0, slide);
    },
    undo(): void {
      const [slide] = pres.slides.splice(to, 1);
      pres.slides.splice(from, 0, slide);
    },
  });
  return label;
}

/** Set (or clear, with undefined) the slide's background override. */
export function setSlideBackgroundOp(
  history: History,
  slide: Slide,
  background: Fill | undefined,
): string {
  const label = 'Format Background';
  const cmd = makeMutation(label, slide, (s) => {
    if (background === undefined) delete s.background;
    else s.background = background;
  });
  history.run(cmd);
  return label;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
