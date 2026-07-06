/**
 * Slide operations: add / delete / duplicate / move, visibility, background
 * overrides, and slide numbering.
 */

import type {
  Fill,
  Id,
  Presentation,
  Slide,
  SlideElement,
  SlideLayout,
} from '../core/types';
import { defaultParagraph, defaultTextBody, defaultTransition } from '../core/defaults';
import { deepClone, genId } from '../core/util';
import { getLayout, getSlide, getSlideIndex } from './lookup';
import { findLayoutByKind } from './layouts';
import { insertSlideIdIntoSections, removeSlideIdFromSections } from './sections';

// ---------------------------------------------------------------------------
// Placeholder instantiation
// ---------------------------------------------------------------------------

/** Clone a layout placeholder into an empty slide placeholder instance. */
function instantiatePlaceholder(layoutElement: SlideElement): SlideElement {
  const el = deepClone(layoutElement);
  el.id = genId('el');
  // Empty out any inherited text content while keeping paragraph formatting.
  if (el.type === 'shape' || el.type === 'textbox') {
    const first = el.textBody.paragraphs[0] ?? defaultParagraph();
    el.textBody.paragraphs = [{ ...first, children: [] }];
  }
  return el;
}

/** Build the placeholder elements a new slide gets from its layout. */
export function instantiateLayoutPlaceholders(layout: SlideLayout): SlideElement[] {
  return layout.elements.filter((e) => e.placeholder !== undefined).map(instantiatePlaceholder);
}

// ---------------------------------------------------------------------------
// Add / delete / duplicate / move
// ---------------------------------------------------------------------------

/**
 * Insert a new slide built from a layout. Defaults to the 'titleAndContent'
 * layout (or the first layout) and appends at the end when no index given.
 */
export function addSlide(pres: Presentation, layoutId?: Id, index?: number): Slide {
  const layout = layoutId
    ? getLayout(pres, layoutId)
    : findLayoutByKind(pres.layouts, 'titleAndContent') ?? pres.layouts[0];
  if (!layout) throw new Error(`Presentation "${pres.id}" has no layouts to build a slide from`);

  const at = index === undefined ? pres.slides.length : index;
  if (at < 0 || at > pres.slides.length) {
    throw new Error(`Cannot insert slide at index ${at}: presentation has ${pres.slides.length} slides`);
  }

  const slide: Slide = {
    id: genId('slide'),
    layoutId: layout.id,
    elements: instantiateLayoutPlaceholders(layout),
    transition: defaultTransition(),
    animations: [],
    notes: defaultTextBody(),
    comments: [],
    hidden: false,
    hideBackgroundGraphics: false,
  };
  pres.slides.splice(at, 0, slide);
  insertSlideIdIntoSections(pres, slide.id, at);
  return slide;
}

/** Delete a slide (also removes it from its section). */
export function deleteSlide(pres: Presentation, slideId: Id): void {
  const index = getSlideIndex(pres, slideId);
  if (index === -1) throw new Error(`Slide "${slideId}" not found in presentation "${pres.id}"`);
  pres.slides.splice(index, 1);
  removeSlideIdFromSections(pres, slideId);
}

/** Regenerate ids on an element tree, recording old -> new mappings. */
function regenerateElementIds(element: SlideElement, idMap: Map<Id, Id>): void {
  const newId = genId('el');
  idMap.set(element.id, newId);
  element.id = newId;
  if (element.type === 'group') {
    for (const child of element.children) regenerateElementIds(child, idMap);
  } else if (element.type === 'table') {
    for (const row of element.rows) {
      for (const cell of row.cells) cell.id = genId('cell');
    }
  }
}

/**
 * Deep-clone a slide directly after the original. Every id is regenerated —
 * the slide, all elements (including nested group children and table cells),
 * animations, comments and replies — and internal references (animation
 * targets, connector attachments) are remapped to the new element ids.
 */
export function duplicateSlide(pres: Presentation, slideId: Id): Slide {
  const index = getSlideIndex(pres, slideId);
  if (index === -1) throw new Error(`Slide "${slideId}" not found in presentation "${pres.id}"`);

  const copy = deepClone(pres.slides[index]);
  copy.id = genId('slide');

  const idMap = new Map<Id, Id>();
  for (const el of copy.elements) regenerateElementIds(el, idMap);

  const remapAttachments = (el: SlideElement): void => {
    if (el.type === 'line') {
      if (el.startAttachment) {
        el.startAttachment.elementId = idMap.get(el.startAttachment.elementId) ?? el.startAttachment.elementId;
      }
      if (el.endAttachment) {
        el.endAttachment.elementId = idMap.get(el.endAttachment.elementId) ?? el.endAttachment.elementId;
      }
    } else if (el.type === 'group') {
      el.children.forEach(remapAttachments);
    }
  };
  copy.elements.forEach(remapAttachments);

  for (const anim of copy.animations) {
    anim.id = genId('anim');
    anim.targetElementId = idMap.get(anim.targetElementId) ?? anim.targetElementId;
  }
  for (const comment of copy.comments) {
    comment.id = genId('comment');
    for (const reply of comment.replies) reply.id = genId('reply');
  }

  pres.slides.splice(index + 1, 0, copy);
  insertSlideIdIntoSections(pres, copy.id, index + 1);
  return copy;
}

/** Move a slide from one index to another (section bookkeeping included). */
export function moveSlide(pres: Presentation, from: number, to: number): void {
  const count = pres.slides.length;
  if (from < 0 || from >= count) throw new Error(`Cannot move slide from index ${from}: presentation has ${count} slides`);
  if (to < 0 || to >= count) throw new Error(`Cannot move slide to index ${to}: presentation has ${count} slides`);
  if (from === to) return;

  const [slide] = pres.slides.splice(from, 1);
  pres.slides.splice(to, 0, slide);
  removeSlideIdFromSections(pres, slide.id);
  insertSlideIdIntoSections(pres, slide.id, to);
}

// ---------------------------------------------------------------------------
// Visibility & background
// ---------------------------------------------------------------------------

export function setSlideHidden(pres: Presentation, slideId: Id, hidden: boolean): void {
  getSlide(pres, slideId).hidden = hidden;
}

/** Override the layout/master background for one slide. */
export function setSlideBackground(pres: Presentation, slideId: Id, fill: Fill): void {
  getSlide(pres, slideId).background = fill;
}

/** Clear the per-slide background override (falls back to layout/master). */
export function clearSlideBackground(pres: Presentation, slideId: Id): void {
  delete getSlide(pres, slideId).background;
}

/** Toggle hiding of layout/master decoration graphics on one slide. */
export function setHideBackgroundGraphics(pres: Presentation, slideId: Id, hide: boolean): void {
  getSlide(pres, slideId).hideBackgroundGraphics = hide;
}

// ---------------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------------

/** 1-based slide number, counting all slides (hidden included). */
export function getSlideNumber(pres: Presentation, slideId: Id): number {
  const index = getSlideIndex(pres, slideId);
  if (index === -1) throw new Error(`Slide "${slideId}" not found in presentation "${pres.id}"`);
  return index + 1;
}

/** All slides that are not hidden, in presentation order. */
export function getVisibleSlides(pres: Presentation): Slide[] {
  return pres.slides.filter((s) => !s.hidden);
}
