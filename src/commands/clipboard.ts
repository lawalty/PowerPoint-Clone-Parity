/**
 * Typed clipboard for slide elements and whole slides. Pastes always mint
 * fresh ids (recursing into group children, table cells, and animations) so
 * pasted content never collides with existing content, and repeated pastes
 * onto the same slide cascade by +12,+12 points.
 */

import type { Id, Slide, SlideElement, Presentation } from '../core/types';
import { deepClone, genId } from '../core/util';

export type ClipboardContentType = 'elements' | 'slides' | null;

type Content =
  | { kind: 'elements'; elements: SlideElement[] }
  | { kind: 'slides'; slides: Slide[]; sourceSlideIds: Id[] }
  | null;

export const PASTE_OFFSET = 12;

/** Assign fresh ids to an element tree, recording old->new in `idMap`. */
export function assignNewIds(element: SlideElement, idMap: Map<Id, Id>): void {
  const newId = genId(element.type);
  idMap.set(element.id, newId);
  element.id = newId;
  if (element.type === 'group') {
    for (const child of element.children) assignNewIds(child, idMap);
  } else if (element.type === 'table') {
    for (const row of element.rows) {
      for (const cell of row.cells) {
        const newCellId = genId('cell');
        idMap.set(cell.id, newCellId);
        cell.id = newCellId;
      }
    }
  }
}

/** Deep-clone an element with all-new ids (group children, table cells). */
export function cloneElementWithNewIds(
  element: SlideElement,
  idMap: Map<Id, Id> = new Map(),
): SlideElement {
  const clone = deepClone(element);
  assignNewIds(clone, idMap);
  return clone;
}

function remapAttachments(element: SlideElement, idMap: Map<Id, Id>): void {
  if (element.type === 'line') {
    if (element.startAttachment) {
      const mapped = idMap.get(element.startAttachment.elementId);
      if (mapped) element.startAttachment.elementId = mapped;
      else delete element.startAttachment;
    }
    if (element.endAttachment) {
      const mapped = idMap.get(element.endAttachment.elementId);
      if (mapped) element.endAttachment.elementId = mapped;
      else delete element.endAttachment;
    }
  } else if (element.type === 'group') {
    for (const child of element.children) remapAttachments(child, idMap);
  }
}

/** Deep-clone a slide with new ids everywhere; animations retargeted. */
export function cloneSlideWithNewIds(slide: Slide): Slide {
  const clone = deepClone(slide);
  clone.id = genId('slide');
  const idMap = new Map<Id, Id>();
  for (const element of clone.elements) assignNewIds(element, idMap);
  for (const element of clone.elements) remapAttachments(element, idMap);
  for (const animation of clone.animations) {
    animation.id = genId('anim');
    const mapped = idMap.get(animation.targetElementId);
    if (mapped) animation.targetElementId = mapped;
  }
  for (const comment of clone.comments) {
    comment.id = genId('comment');
    for (const reply of comment.replies) reply.id = genId('reply');
  }
  return clone;
}

export class Clipboard {
  private content: Content = null;
  private pasteCount = 0;
  private lastPasteSlideId: Id | null = null;

  isEmpty(): boolean {
    return this.content === null;
  }

  contentType(): ClipboardContentType {
    return this.content ? this.content.kind : null;
  }

  clear(): void {
    this.content = null;
    this.resetPasteTracking();
  }

  // --- Elements -------------------------------------------------------------

  /** Store a deep-cloned snapshot of the given elements. */
  copyElements(elements: SlideElement[]): void {
    this.content = { kind: 'elements', elements: deepClone(elements) };
    this.resetPasteTracking();
  }

  /**
   * Remove the elements with the given ids from the slide, store them on the
   * clipboard, and return the removed elements (in slide order).
   */
  cutElements(slide: Slide, ids: Id[]): SlideElement[] {
    const idSet = new Set(ids);
    const removed: SlideElement[] = [];
    for (let i = slide.elements.length - 1; i >= 0; i--) {
      const element = slide.elements[i];
      if (idSet.has(element.id)) {
        slide.elements.splice(i, 1);
        removed.unshift(element);
      }
    }
    this.content = { kind: 'elements', elements: deepClone(removed) };
    this.resetPasteTracking();
    return removed;
  }

  /**
   * Append clones of the clipboard elements to the slide, with all-new ids
   * (recursing into groups and tables) and a cascading +offset,+offset shift
   * per consecutive paste onto the same slide. Returns the pasted elements.
   */
  pasteElements(slide: Slide, opts: { offset?: number } = {}): SlideElement[] {
    if (this.content?.kind !== 'elements') return [];

    if (this.lastPasteSlideId === slide.id) {
      this.pasteCount += 1;
    } else {
      this.pasteCount = 1;
      this.lastPasteSlideId = slide.id;
    }
    const step = opts.offset ?? PASTE_OFFSET;
    const shift = this.pasteCount * step;

    const idMap = new Map<Id, Id>();
    const pasted = this.content.elements.map((element) =>
      cloneElementWithNewIds(element, idMap),
    );
    for (const element of pasted) {
      remapAttachments(element, idMap);
      element.transform.x += shift;
      element.transform.y += shift;
    }
    slide.elements.push(...pasted);
    return pasted;
  }

  // --- Slides ---------------------------------------------------------------

  /** Store deep-cloned snapshots of the given slides (in presentation order). */
  copySlides(pres: Presentation, slideIds: Id[]): void {
    const idSet = new Set(slideIds);
    const slides = pres.slides.filter((slide) => idSet.has(slide.id));
    this.content = {
      kind: 'slides',
      slides: deepClone(slides),
      sourceSlideIds: slides.map((slide) => slide.id),
    };
    this.resetPasteTracking();
  }

  /**
   * Insert clones of the clipboard slides into the presentation with new ids
   * for the slide and every element/animation (animation targetElementId is
   * remapped to the new element ids). Inserted after the last copied slide
   * still present, or at `atIndex` when given. Returns the pasted slides.
   */
  pasteSlides(pres: Presentation, atIndex?: number): Slide[] {
    if (this.content?.kind !== 'slides') return [];

    let insertAt: number;
    if (atIndex !== undefined) {
      insertAt = Math.max(0, Math.min(atIndex, pres.slides.length));
    } else {
      let maxIndex = -1;
      for (const id of this.content.sourceSlideIds) {
        const index = pres.slides.findIndex((slide) => slide.id === id);
        if (index > maxIndex) maxIndex = index;
      }
      insertAt = maxIndex >= 0 ? maxIndex + 1 : pres.slides.length;
    }

    const pasted = this.content.slides.map((slide) => cloneSlideWithNewIds(slide));
    pres.slides.splice(insertAt, 0, ...pasted);
    return pasted;
  }

  // --- internal -------------------------------------------------------------

  private resetPasteTracking(): void {
    this.pasteCount = 0;
    this.lastPasteSlideId = null;
  }
}
