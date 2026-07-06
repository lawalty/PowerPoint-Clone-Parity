/**
 * Section operations. Sections partition the slide order: every slide id
 * appears in at most one section, and section slideIds follow presentation
 * order. When no sections exist, all slides are simply unsectioned.
 */

import type { Id, Presentation, Section, Slide } from '../core/types';
import { genId } from '../core/util';

function getSection(pres: Presentation, sectionId: Id): Section {
  const section = pres.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error(`Section "${sectionId}" not found in presentation "${pres.id}"`);
  return section;
}

/** The section a slide belongs to, or undefined when unsectioned. */
export function sectionForSlide(pres: Presentation, slideId: Id): Section | undefined {
  return pres.sections.find((s) => s.slideIds.includes(slideId));
}

/**
 * Create a new section starting at the given slide index. The section takes
 * ownership of the slides from that index up to the start of the next
 * section (or the end of the presentation). If this is the first section and
 * there are slides before `atSlideIndex`, they are gathered into an implicit
 * "Default Section" so sections always partition the whole slide order.
 */
export function addSection(pres: Presentation, name: string, atSlideIndex: number): Section {
  if (atSlideIndex < 0 || atSlideIndex >= pres.slides.length) {
    throw new Error(`Cannot add section at slide index ${atSlideIndex}: presentation has ${pres.slides.length} slides`);
  }

  if (pres.sections.length === 0) {
    if (atSlideIndex > 0) {
      pres.sections.push({
        id: genId('section'),
        name: 'Default Section',
        slideIds: pres.slides.slice(0, atSlideIndex).map((s) => s.id),
      });
    }
    const section: Section = {
      id: genId('section'),
      name,
      slideIds: pres.slides.slice(atSlideIndex).map((s) => s.id),
    };
    pres.sections.push(section);
    return section;
  }

  const slideId = pres.slides[atSlideIndex].id;
  const owner = sectionForSlide(pres, slideId);
  if (!owner) {
    // Defensive: unsectioned slide with sections present. Claim the tail.
    const section: Section = { id: genId('section'), name, slideIds: [slideId] };
    pres.sections.push(section);
    return section;
  }
  const splitAt = owner.slideIds.indexOf(slideId);
  const section: Section = {
    id: genId('section'),
    name,
    slideIds: owner.slideIds.slice(splitAt),
  };
  owner.slideIds = owner.slideIds.slice(0, splitAt);
  pres.sections.splice(pres.sections.indexOf(owner) + 1, 0, section);
  return section;
}

/**
 * Remove a section, keeping its slides: they merge into the previous section
 * (or the next one when removing the first). Removing the only section
 * leaves the presentation unsectioned.
 */
export function removeSection(pres: Presentation, sectionId: Id): void {
  const section = getSection(pres, sectionId);
  const index = pres.sections.indexOf(section);
  pres.sections.splice(index, 1);
  if (pres.sections.length === 0) return;
  if (index > 0) {
    pres.sections[index - 1].slideIds.push(...section.slideIds);
  } else {
    pres.sections[0].slideIds.unshift(...section.slideIds);
  }
}

export function renameSection(pres: Presentation, sectionId: Id, name: string): void {
  getSection(pres, sectionId).name = name;
}

/**
 * Move a section (and its slides) to a new position among the sections.
 * The slide order is rebuilt so slides keep following their sections.
 */
export function moveSection(pres: Presentation, sectionId: Id, toIndex: number): void {
  const section = getSection(pres, sectionId);
  if (toIndex < 0 || toIndex >= pres.sections.length) {
    throw new Error(`Cannot move section to index ${toIndex}: presentation has ${pres.sections.length} sections`);
  }
  const fromIndex = pres.sections.indexOf(section);
  if (fromIndex === toIndex) return;
  pres.sections.splice(fromIndex, 1);
  pres.sections.splice(toIndex, 0, section);

  // Rebuild slide order from the section order.
  const byId = new Map<Id, Slide>(pres.slides.map((s) => [s.id, s]));
  const ordered: Slide[] = [];
  for (const sec of pres.sections) {
    for (const id of sec.slideIds) {
      const slide = byId.get(id);
      if (slide) {
        ordered.push(slide);
        byId.delete(id);
      }
    }
  }
  // Defensive: keep any unsectioned slides at the end, in their old order.
  for (const slide of pres.slides) {
    if (byId.has(slide.id)) ordered.push(slide);
  }
  pres.slides = ordered;
}

// ---------------------------------------------------------------------------
// Bookkeeping helpers used by the slide operations
// ---------------------------------------------------------------------------

/** Remove a slide id from whichever section holds it (if any). */
export function removeSlideIdFromSections(pres: Presentation, slideId: Id): void {
  for (const section of pres.sections) {
    const i = section.slideIds.indexOf(slideId);
    if (i !== -1) section.slideIds.splice(i, 1);
  }
}

/**
 * Register a slide that now sits at `slideIndex` in pres.slides with the
 * appropriate section: it joins the section of the slide before it, or the
 * first section when inserted at the front. No-op when no sections exist.
 */
export function insertSlideIdIntoSections(pres: Presentation, slideId: Id, slideIndex: number): void {
  if (pres.sections.length === 0) return;
  if (slideIndex > 0) {
    const prevId = pres.slides[slideIndex - 1].id;
    const section = sectionForSlide(pres, prevId);
    if (section) {
      section.slideIds.splice(section.slideIds.indexOf(prevId) + 1, 0, slideId);
      return;
    }
  }
  const next = pres.slides[slideIndex + 1];
  const target = (next && sectionForSlide(pres, next.id)) ?? pres.sections[0];
  target.slideIds.unshift(slideId);
}
