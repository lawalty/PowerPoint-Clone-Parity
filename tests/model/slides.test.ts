import { describe, expect, it } from 'vitest';
import type { GroupElement, Presentation, ShapeElement } from '../../src/core/types';
import { defaultEffects, defaultLine, defaultTextBody, defaultTransform } from '../../src/core/defaults';
import { genId } from '../../src/core/util';
import {
  addSlide,
  clearSlideBackground,
  createPresentation,
  deleteSlide,
  duplicateSlide,
  findLayoutByKind,
  getSlideIndex,
  getSlideNumber,
  getVisibleSlides,
  moveSlide,
  setHideBackgroundGraphics,
  setSlideBackground,
  setSlideHidden,
} from '../../src/model';

function makeShape(): ShapeElement {
  return {
    id: genId('el'),
    type: 'shape',
    name: 'Shape',
    transform: defaultTransform(),
    hidden: false,
    locked: false,
    geometry: 'rectangle',
    fill: { type: 'solid', color: { type: 'theme', slot: 'accent1' } },
    line: defaultLine(),
    effects: defaultEffects(),
    textBody: defaultTextBody(),
  };
}

describe('addSlide', () => {
  it('appends a titleAndContent slide by default', () => {
    const pres = createPresentation();
    const slide = addSlide(pres);
    expect(pres.slides).toHaveLength(2);
    expect(pres.slides[1]).toBe(slide);
    const layout = pres.layouts.find((l) => l.id === slide.layoutId)!;
    expect(layout.kind).toBe('titleAndContent');
  });

  it('instantiates the layout placeholders as empty slide placeholders', () => {
    const pres = createPresentation();
    const layout = findLayoutByKind(pres.layouts, 'twoContent')!;
    const slide = addSlide(pres, layout.id);
    expect(slide.elements).toHaveLength(3);
    expect(slide.elements.map((e) => e.placeholder?.kind)).toEqual(['title', 'content', 'content']);
    // linked back by placeholder index, fresh ids, no text
    for (const [i, el] of slide.elements.entries()) {
      const src = layout.elements[i];
      expect(el.placeholder!.index).toBe(src.placeholder!.index);
      expect(el.id).not.toBe(src.id);
      expect(el.transform).toEqual(src.transform);
      if (el.type === 'textbox') {
        expect(el.textBody.paragraphs).toHaveLength(1);
        expect(el.textBody.paragraphs[0].children).toEqual([]);
      }
    }
  });

  it('inserts at a given index and produces no elements for the blank layout', () => {
    const pres = createPresentation();
    const blank = findLayoutByKind(pres.layouts, 'blank')!;
    const slide = addSlide(pres, blank.id, 0);
    expect(pres.slides[0]).toBe(slide);
    expect(slide.elements).toEqual([]);
  });

  it('rejects unknown layouts and out-of-range indices', () => {
    const pres = createPresentation();
    expect(() => addSlide(pres, 'nope')).toThrow(/Layout "nope" not found/);
    expect(() => addSlide(pres, undefined, 5)).toThrow(/Cannot insert slide at index 5/);
    expect(() => addSlide(pres, undefined, -1)).toThrow(/Cannot insert slide at index -1/);
  });
});

describe('deleteSlide / moveSlide / getSlideIndex', () => {
  function threeSlides(): Presentation {
    const pres = createPresentation();
    addSlide(pres);
    addSlide(pres);
    return pres;
  }

  it('deletes a slide by id', () => {
    const pres = threeSlides();
    const [a, b, c] = pres.slides;
    deleteSlide(pres, b.id);
    expect(pres.slides.map((s) => s.id)).toEqual([a.id, c.id]);
    expect(() => deleteSlide(pres, b.id)).toThrow(/not found/);
  });

  it('can delete the last remaining slide', () => {
    const pres = createPresentation();
    deleteSlide(pres, pres.slides[0].id);
    expect(pres.slides).toEqual([]);
  });

  it('moves slides and treats same-index moves as a no-op', () => {
    const pres = threeSlides();
    const [a, b, c] = pres.slides;
    moveSlide(pres, 0, 2);
    expect(pres.slides.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
    moveSlide(pres, 1, 1);
    expect(pres.slides.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
    moveSlide(pres, 2, 0);
    expect(pres.slides.map((s) => s.id)).toEqual([a.id, b.id, c.id]);
    expect(() => moveSlide(pres, 0, 3)).toThrow(/Cannot move slide to index 3/);
    expect(() => moveSlide(pres, -1, 0)).toThrow(/Cannot move slide from index -1/);
  });

  it('reports slide indices', () => {
    const pres = threeSlides();
    expect(getSlideIndex(pres, pres.slides[2].id)).toBe(2);
    expect(getSlideIndex(pres, 'missing')).toBe(-1);
  });
});

describe('duplicateSlide', () => {
  it('deep-clones directly after the original with all-new ids', () => {
    const pres = createPresentation();
    addSlide(pres);
    const original = pres.slides[0];
    const copy = duplicateSlide(pres, original.id);

    expect(pres.slides).toHaveLength(3);
    expect(pres.slides[1]).toBe(copy);
    expect(copy.id).not.toBe(original.id);
    expect(copy.elements).toHaveLength(original.elements.length);
    copy.elements.forEach((el, i) => {
      expect(el.id).not.toBe(original.elements[i].id);
      expect(el.placeholder).toEqual(original.elements[i].placeholder);
    });
    // mutating the copy leaves the original untouched
    copy.elements[0].name = 'renamed';
    expect(original.elements[0].name).not.toBe('renamed');
  });

  it('regenerates nested group child ids and remaps animation targets', () => {
    const pres = createPresentation();
    const slide = pres.slides[0];
    const inner = makeShape();
    const group: GroupElement = {
      id: genId('el'),
      type: 'group',
      name: 'Group',
      transform: defaultTransform(),
      hidden: false,
      locked: false,
      children: [inner, makeShape()],
    };
    slide.elements.push(group);
    slide.animations.push({
      id: genId('anim'),
      targetElementId: inner.id,
      category: 'entrance',
      effect: 'fade',
      trigger: 'onClick',
      delay: 0,
      duration: 500,
      repeat: 1,
    });

    const copy = duplicateSlide(pres, slide.id);
    const copiedGroup = copy.elements.find((e) => e.type === 'group') as GroupElement;
    expect(copiedGroup.id).not.toBe(group.id);
    expect(copiedGroup.children[0].id).not.toBe(inner.id);
    expect(copiedGroup.children[1].id).not.toBe(group.children[1].id);

    expect(copy.animations).toHaveLength(1);
    expect(copy.animations[0].id).not.toBe(slide.animations[0].id);
    expect(copy.animations[0].targetElementId).toBe(copiedGroup.children[0].id);
    expect(slide.animations[0].targetElementId).toBe(inner.id);
  });

  it('clones comments and replies with fresh ids', () => {
    const pres = createPresentation();
    const slide = pres.slides[0];
    slide.comments.push({
      id: 'c1',
      author: 'Ada',
      text: 'hello',
      createdAt: 1,
      position: { x: 10, y: 20 },
      replies: [{ id: 'r1', author: 'Bob', text: 'hi', createdAt: 2 }],
      resolved: false,
    });
    const copy = duplicateSlide(pres, slide.id);
    expect(copy.comments).toHaveLength(1);
    expect(copy.comments[0].id).not.toBe('c1');
    expect(copy.comments[0].replies[0].id).not.toBe('r1');
    expect(copy.comments[0].text).toBe('hello');
    expect(copy.comments[0].replies[0].text).toBe('hi');
  });
});

describe('visibility, numbering & backgrounds', () => {
  it('hides slides and excludes them from getVisibleSlides', () => {
    const pres = createPresentation();
    addSlide(pres);
    addSlide(pres);
    setSlideHidden(pres, pres.slides[1].id, true);
    expect(pres.slides[1].hidden).toBe(true);
    const visible = getVisibleSlides(pres);
    expect(visible.map((s) => s.id)).toEqual([pres.slides[0].id, pres.slides[2].id]);
    setSlideHidden(pres, pres.slides[1].id, false);
    expect(getVisibleSlides(pres)).toHaveLength(3);
  });

  it('numbers slides 1-based counting hidden slides', () => {
    const pres = createPresentation();
    addSlide(pres);
    addSlide(pres);
    setSlideHidden(pres, pres.slides[0].id, true);
    expect(getSlideNumber(pres, pres.slides[0].id)).toBe(1);
    expect(getSlideNumber(pres, pres.slides[2].id)).toBe(3);
    expect(() => getSlideNumber(pres, 'ghost')).toThrow(/Slide "ghost" not found/);
  });

  it('sets and clears the per-slide background override', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    expect(pres.slides[0].background).toBeUndefined();
    setSlideBackground(pres, id, { type: 'solid', color: { type: 'rgb', value: 'FF0000' } });
    expect(pres.slides[0].background).toEqual({ type: 'solid', color: { type: 'rgb', value: 'FF0000' } });
    clearSlideBackground(pres, id);
    expect(pres.slides[0].background).toBeUndefined();
    expect('background' in pres.slides[0]).toBe(false);
  });

  it('toggles hideBackgroundGraphics', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    expect(pres.slides[0].hideBackgroundGraphics).toBe(false);
    setHideBackgroundGraphics(pres, id, true);
    expect(pres.slides[0].hideBackgroundGraphics).toBe(true);
    setHideBackgroundGraphics(pres, id, false);
    expect(pres.slides[0].hideBackgroundGraphics).toBe(false);
  });
});
