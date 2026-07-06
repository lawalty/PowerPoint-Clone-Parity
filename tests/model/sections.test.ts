import { describe, expect, it } from 'vitest';
import type { Presentation } from '../../src/core/types';
import {
  addSection,
  addSlide,
  createPresentation,
  deleteSlide,
  duplicateSlide,
  moveSection,
  moveSlide,
  removeSection,
  renameSection,
  sectionForSlide,
} from '../../src/model';

/** 4 slides, no sections. */
function fourSlides(): Presentation {
  const pres = createPresentation();
  addSlide(pres);
  addSlide(pres);
  addSlide(pres);
  return pres;
}

const slideIds = (pres: Presentation) => pres.slides.map((s) => s.id);

describe('addSection', () => {
  it('creates an implicit Default Section for leading slides', () => {
    const pres = fourSlides();
    const [a, b, c, d] = slideIds(pres);
    const intro = addSection(pres, 'Intro', 2);
    expect(pres.sections).toHaveLength(2);
    expect(pres.sections[0].name).toBe('Default Section');
    expect(pres.sections[0].slideIds).toEqual([a, b]);
    expect(pres.sections[1]).toBe(intro);
    expect(intro.slideIds).toEqual([c, d]);
  });

  it('covers all slides when added at index 0', () => {
    const pres = fourSlides();
    const all = addSection(pres, 'Everything', 0);
    expect(pres.sections).toHaveLength(1);
    expect(all.slideIds).toEqual(slideIds(pres));
  });

  it('splits an existing section at the given slide', () => {
    const pres = fourSlides();
    const [a, b, c, d] = slideIds(pres);
    addSection(pres, 'All', 0);
    const tail = addSection(pres, 'Tail', 3);
    expect(pres.sections.map((s) => s.name)).toEqual(['All', 'Tail']);
    expect(pres.sections[0].slideIds).toEqual([a, b, c]);
    expect(tail.slideIds).toEqual([d]);
  });

  it('rejects out-of-range indices', () => {
    const pres = fourSlides();
    expect(() => addSection(pres, 'Bad', 4)).toThrow(/Cannot add section at slide index 4/);
    expect(() => addSection(pres, 'Bad', -1)).toThrow(/Cannot add section at slide index -1/);
  });
});

describe('removeSection / renameSection / sectionForSlide', () => {
  it('removes a section but keeps its slides (merged into the previous section)', () => {
    const pres = fourSlides();
    addSection(pres, 'A', 0);
    const b = addSection(pres, 'B', 2);
    removeSection(pres, b.id);
    expect(pres.sections).toHaveLength(1);
    expect(pres.sections[0].slideIds).toEqual(slideIds(pres));
    expect(pres.slides).toHaveLength(4);
  });

  it('merges into the next section when removing the first', () => {
    const pres = fourSlides();
    const a = addSection(pres, 'A', 0);
    addSection(pres, 'B', 2);
    removeSection(pres, a.id);
    expect(pres.sections.map((s) => s.name)).toEqual(['B']);
    expect(pres.sections[0].slideIds).toEqual(slideIds(pres));
  });

  it('removing the only section leaves the deck unsectioned', () => {
    const pres = fourSlides();
    const only = addSection(pres, 'Only', 0);
    removeSection(pres, only.id);
    expect(pres.sections).toEqual([]);
    expect(pres.slides).toHaveLength(4);
  });

  it('renames sections and resolves sectionForSlide', () => {
    const pres = fourSlides();
    const sec = addSection(pres, 'Old', 2);
    renameSection(pres, sec.id, 'New');
    expect(sec.name).toBe('New');
    expect(sectionForSlide(pres, pres.slides[3].id)).toBe(sec);
    expect(sectionForSlide(pres, pres.slides[0].id)?.name).toBe('Default Section');
    expect(() => renameSection(pres, 'nope', 'X')).toThrow(/Section "nope" not found/);
  });
});

describe('moveSection', () => {
  it('reorders sections and their slides together', () => {
    const pres = fourSlides();
    const [a, b, c, d] = slideIds(pres);
    addSection(pres, 'First', 0); // a, b
    const second = addSection(pres, 'Second', 2); // c, d
    moveSection(pres, second.id, 0);
    expect(pres.sections.map((s) => s.name)).toEqual(['Second', 'First']);
    expect(slideIds(pres)).toEqual([c, d, a, b]);
    // moving to its current index is a no-op
    moveSection(pres, second.id, 0);
    expect(slideIds(pres)).toEqual([c, d, a, b]);
    expect(() => moveSection(pres, second.id, 2)).toThrow(/Cannot move section to index 2/);
  });
});

describe('section bookkeeping through slide operations', () => {
  it('adds new slides to the section of the preceding slide', () => {
    const pres = fourSlides();
    addSection(pres, 'A', 0);
    const bSec = addSection(pres, 'B', 2);
    const inserted = addSlide(pres, undefined, 3); // between slides c and d
    expect(sectionForSlide(pres, inserted.id)).toBe(bSec);
    expect(bSec.slideIds).toEqual([pres.slides[2].id, inserted.id, pres.slides[4].id]);
    const front = addSlide(pres, undefined, 0);
    expect(sectionForSlide(pres, front.id)?.name).toBe('A');
    expect(pres.sections[0].slideIds[0]).toBe(front.id);
  });

  it('keeps sections consistent after slide deletion (even to empty)', () => {
    const pres = fourSlides();
    addSection(pres, 'A', 0);
    const tail = addSection(pres, 'Tail', 3);
    const last = pres.slides[3];
    deleteSlide(pres, last.id);
    expect(tail.slideIds).toEqual([]);
    expect(pres.sections).toHaveLength(2); // empty sections are kept
    expect(pres.sections[0].slideIds).toEqual(slideIds(pres));
  });

  it('re-homes a slide when moved across a section boundary', () => {
    const pres = fourSlides();
    const secA = addSection(pres, 'A', 0);
    const secB = addSection(pres, 'B', 2);
    const moved = pres.slides[0];
    moveSlide(pres, 0, 3);
    expect(sectionForSlide(pres, moved.id)).toBe(secB);
    expect(secA.slideIds).not.toContain(moved.id);
    expect(secB.slideIds).toEqual([pres.slides[1].id, pres.slides[2].id, moved.id]);
    // every slide is still in exactly one section
    const owned = pres.sections.flatMap((s) => s.slideIds);
    expect([...owned].sort()).toEqual([...slideIds(pres)].sort());
  });

  it('puts duplicates in the same section as the original', () => {
    const pres = fourSlides();
    addSection(pres, 'A', 0);
    const secB = addSection(pres, 'B', 2);
    const copy = duplicateSlide(pres, pres.slides[2].id);
    expect(sectionForSlide(pres, copy.id)).toBe(secB);
    expect(secB.slideIds).toEqual([pres.slides[2].id, copy.id, pres.slides[4].id]);
  });
});
