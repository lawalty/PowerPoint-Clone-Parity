import { describe, it, expect } from 'vitest';
import {
  History,
  addElementOp,
  deleteElementsOp,
  duplicateElementsOp,
  reorderSlideOp,
  setSlideBackgroundOp,
} from '../../src/commands';
import type { Fill } from '../../src/core/types';
import { makeAnimation, makePresentation, makeShape, makeSlide } from './helpers';

describe('deleteElementsOp', () => {
  it('deletes elements and their animations, fully undoable/redoable', () => {
    const a = makeShape({ name: 'a' });
    const b = makeShape({ name: 'b' });
    const c = makeShape({ name: 'c' });
    const slide = makeSlide([a, b, c], {
      animations: [makeAnimation(a.id), makeAnimation(b.id)],
    });
    const h = new History();

    const label = deleteElementsOp(h, slide, [a.id, c.id]);
    expect(label).toBe('Delete 2 Elements');
    expect(h.undoLabel).toBe(label);
    expect(slide.elements.map((el) => el.name)).toEqual(['b']);
    expect(slide.animations).toHaveLength(1);
    expect(slide.animations[0].targetElementId).toBe(b.id);

    h.undo();
    expect(slide.elements.map((el) => el.name)).toEqual(['a', 'b', 'c']);
    expect(slide.animations).toHaveLength(2);

    h.redo();
    expect(slide.elements.map((el) => el.name)).toEqual(['b']);
    expect(slide.animations).toHaveLength(1);
  });

  it('uses a singular label for one element', () => {
    const a = makeShape();
    const slide = makeSlide([a]);
    const h = new History();
    expect(deleteElementsOp(h, slide, [a.id])).toBe('Delete Element');
  });
});

describe('addElementOp', () => {
  it('appends the element and is undoable', () => {
    const slide = makeSlide();
    const h = new History();
    const shape = makeShape();

    const label = addElementOp(h, slide, shape);
    expect(label).toBe('Add Shape');
    expect(h.undoLabel).toBe('Add Shape');
    expect(slide.elements).toHaveLength(1);
    expect(slide.elements[0].id).toBe(shape.id);

    h.undo();
    expect(slide.elements).toHaveLength(0);
    h.redo();
    expect(slide.elements).toHaveLength(1);
    expect(slide.elements[0].id).toBe(shape.id);
  });
});

describe('duplicateElementsOp', () => {
  it('clones with new ids and +12,+12 offset, undoable/redoable', () => {
    const a = makeShape(); // x=10, y=20
    const slide = makeSlide([a]);
    const h = new History();

    const label = duplicateElementsOp(h, slide, [a.id]);
    expect(label).toBe('Duplicate Element');
    expect(slide.elements).toHaveLength(2);
    const dup = slide.elements[1];
    expect(dup.id).not.toBe(a.id);
    expect(dup.transform.x).toBe(22);
    expect(dup.transform.y).toBe(32);

    h.undo();
    expect(slide.elements).toHaveLength(1);
    expect(slide.elements[0].id).toBe(a.id);

    h.redo();
    expect(slide.elements).toHaveLength(2);
    // Redo restores the same duplicate (stable id across undo/redo).
    expect(slide.elements[1].id).toBe(dup.id);
  });

  it('duplicates multiple elements at once', () => {
    const a = makeShape();
    const b = makeShape();
    const slide = makeSlide([a, b]);
    const h = new History();
    const label = duplicateElementsOp(h, slide, [a.id, b.id]);
    expect(label).toBe('Duplicate 2 Elements');
    expect(slide.elements).toHaveLength(4);
    const ids = slide.elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('reorderSlideOp', () => {
  it('moves a slide and restores order on undo', () => {
    const s1 = makeSlide();
    const s2 = makeSlide();
    const s3 = makeSlide();
    const pres = makePresentation([s1, s2, s3]);
    const h = new History();

    const label = reorderSlideOp(h, pres, 0, 2);
    expect(label).toBe('Move Slide');
    expect(pres.slides.map((s) => s.id)).toEqual([s2.id, s3.id, s1.id]);

    h.undo();
    expect(pres.slides.map((s) => s.id)).toEqual([s1.id, s2.id, s3.id]);
    h.redo();
    expect(pres.slides.map((s) => s.id)).toEqual([s2.id, s3.id, s1.id]);
    // The slide objects themselves are preserved (moved, not cloned).
    expect(pres.slides[2]).toBe(s1);
  });

  it('rejects out-of-range indices', () => {
    const pres = makePresentation([makeSlide()]);
    const h = new History();
    expect(() => reorderSlideOp(h, pres, 0, 5)).toThrow(/out of range/);
    expect(h.canUndo).toBe(false);
  });
});

describe('setSlideBackgroundOp', () => {
  const red: Fill = { type: 'solid', color: { type: 'rgb', value: 'FF0000' } };
  const blue: Fill = { type: 'solid', color: { type: 'rgb', value: '0000FF' } };

  it('sets a background and undo restores the previous one', () => {
    const slide = makeSlide([], { background: red });
    const h = new History();

    const label = setSlideBackgroundOp(h, slide, blue);
    expect(label).toBe('Format Background');
    expect(slide.background).toEqual(blue);

    h.undo();
    expect(slide.background).toEqual(red);
    h.redo();
    expect(slide.background).toEqual(blue);
  });

  it('undo restores an absent background (undefined)', () => {
    const slide = makeSlide();
    const h = new History();
    setSlideBackgroundOp(h, slide, red);
    expect(slide.background).toEqual(red);
    h.undo();
    expect(slide.background).toBeUndefined();
    expect('background' in slide).toBe(false);
  });

  it('can clear a background with undefined', () => {
    const slide = makeSlide([], { background: red });
    const h = new History();
    setSlideBackgroundOp(h, slide, undefined);
    expect(slide.background).toBeUndefined();
    h.undo();
    expect(slide.background).toEqual(red);
  });
});

describe('ops integration', () => {
  it('a sequence of ops undoes back to the initial document', () => {
    const a = makeShape({ name: 'a' });
    const slide1 = makeSlide([a]);
    const slide2 = makeSlide();
    const pres = makePresentation([slide1, slide2]);
    const h = new History();

    addElementOp(h, slide1, makeShape({ name: 'b' }));
    duplicateElementsOp(h, slide1, [a.id]);
    deleteElementsOp(h, slide1, [a.id]);
    reorderSlideOp(h, pres, 0, 1);
    setSlideBackgroundOp(h, slide2, {
      type: 'solid',
      color: { type: 'rgb', value: '00FF00' },
    });

    expect(h.canUndo).toBe(true);
    let steps = 0;
    while (h.canUndo) {
      h.undo();
      steps++;
    }
    expect(steps).toBe(5);
    expect(pres.slides[0]).toBe(slide1);
    expect(slide1.elements.map((el) => el.name)).toEqual(['a']);
    expect(slide2.background).toBeUndefined();

    while (h.canRedo) h.redo();
    expect(pres.slides[1]).toBe(slide1);
    // 'a' was duplicated (clone keeps the name) then the original deleted.
    expect(slide1.elements.map((el) => el.name)).toEqual(['b', 'a']);
  });
});
