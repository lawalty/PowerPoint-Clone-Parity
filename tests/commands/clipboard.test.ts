import { describe, it, expect } from 'vitest';
import { Clipboard, History, makeMutation } from '../../src/commands';
import {
  collectIds,
  makeAnimation,
  makeGroup,
  makePresentation,
  makeShape,
  makeSlide,
  makeTable,
} from './helpers';

describe('Clipboard: state', () => {
  it('reports isEmpty/contentType transitions', () => {
    const cb = new Clipboard();
    expect(cb.isEmpty()).toBe(true);
    expect(cb.contentType()).toBeNull();

    cb.copyElements([makeShape()]);
    expect(cb.isEmpty()).toBe(false);
    expect(cb.contentType()).toBe('elements');

    const pres = makePresentation([makeSlide()]);
    cb.copySlides(pres, [pres.slides[0].id]);
    expect(cb.contentType()).toBe('slides');

    cb.clear();
    expect(cb.isEmpty()).toBe(true);
    expect(cb.contentType()).toBeNull();
  });

  it('pasteElements/pasteSlides return [] for mismatched content', () => {
    const cb = new Clipboard();
    const slide = makeSlide();
    const pres = makePresentation([slide]);
    expect(cb.pasteElements(slide)).toEqual([]);
    expect(cb.pasteSlides(pres)).toEqual([]);
  });
});

describe('Clipboard: elements', () => {
  it('copy takes a deep snapshot isolated from later edits', () => {
    const cb = new Clipboard();
    const shape = makeShape();
    cb.copyElements([shape]);
    shape.transform.x = 999;
    shape.name = 'mutated';

    const slide = makeSlide();
    const [pasted] = cb.pasteElements(slide);
    expect(pasted.transform.x).toBe(10 + 12); // original x + first-paste offset
    expect(pasted.name).toBe('Shape');
  });

  it('paste mints new ids with no collision against originals (nested groups + tables)', () => {
    const cb = new Clipboard();
    const inner = makeShape();
    const table = makeTable(2, 2);
    const group = makeGroup([inner, makeGroup([makeShape()])]);
    const slide = makeSlide([group, table]);

    cb.copyElements([group, table]);
    const pasted = cb.pasteElements(slide);
    expect(pasted).toHaveLength(2);

    const originalIds = new Set([...collectIds(group), ...collectIds(table)]);
    const pastedIds = pasted.flatMap((el) => collectIds(el));
    // Every id (elements, nested group children, table cells) is fresh.
    expect(pastedIds.length).toBe(originalIds.size);
    for (const id of pastedIds) expect(originalIds.has(id)).toBe(false);
    // And unique among themselves.
    expect(new Set(pastedIds).size).toBe(pastedIds.length);
  });

  it('appends pasted elements to the slide and is repeatable', () => {
    const cb = new Clipboard();
    const slide = makeSlide([makeShape()]);
    cb.copyElements([slide.elements[0]]);
    cb.pasteElements(slide);
    cb.pasteElements(slide);
    expect(slide.elements).toHaveLength(3);
    const ids = slide.elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('offsets repeated pastes on the same slide by 12/24/36', () => {
    const cb = new Clipboard();
    const shape = makeShape(); // x=10, y=20
    const slide = makeSlide();
    cb.copyElements([shape]);

    const [p1] = cb.pasteElements(slide);
    const [p2] = cb.pasteElements(slide);
    const [p3] = cb.pasteElements(slide);
    expect([p1.transform.x, p1.transform.y]).toEqual([22, 32]);
    expect([p2.transform.x, p2.transform.y]).toEqual([34, 44]);
    expect([p3.transform.x, p3.transform.y]).toEqual([46, 56]);
  });

  it('resets the paste offset when clipboard content changes', () => {
    const cb = new Clipboard();
    const slide = makeSlide();
    cb.copyElements([makeShape()]);
    cb.pasteElements(slide);
    cb.pasteElements(slide); // offset now 24

    cb.copyElements([makeShape()]); // new content -> counter reset
    const [pasted] = cb.pasteElements(slide);
    expect(pasted.transform.x).toBe(22);
  });

  it('supports cross-slide paste with per-slide offset tracking', () => {
    const cb = new Clipboard();
    const slideA = makeSlide();
    const slideB = makeSlide();
    cb.copyElements([makeShape()]);

    const [a1] = cb.pasteElements(slideA);
    expect(a1.transform.x).toBe(22);
    const [b1] = cb.pasteElements(slideB); // different slide -> offset resets
    expect(b1.transform.x).toBe(22);
    const [b2] = cb.pasteElements(slideB);
    expect(b2.transform.x).toBe(34);
    expect(slideA.elements).toHaveLength(1);
    expect(slideB.elements).toHaveLength(2);
  });

  it('honors a custom offset step', () => {
    const cb = new Clipboard();
    const slide = makeSlide();
    cb.copyElements([makeShape()]);
    const [p1] = cb.pasteElements(slide, { offset: 5 });
    expect([p1.transform.x, p1.transform.y]).toEqual([15, 25]);
  });

  it('cut removes elements from the slide and returns them in order', () => {
    const cb = new Clipboard();
    const a = makeShape({ name: 'a' });
    const b = makeShape({ name: 'b' });
    const c = makeShape({ name: 'c' });
    const slide = makeSlide([a, b, c]);

    const removed = cb.cutElements(slide, [c.id, a.id]);
    expect(removed.map((el) => el.name)).toEqual(['a', 'c']);
    expect(slide.elements.map((el) => el.name)).toEqual(['b']);
    expect(cb.contentType()).toBe('elements');

    const [pasted] = cb.pasteElements(slide);
    expect(pasted.id).not.toBe(a.id);
    expect(slide.elements).toHaveLength(3);
  });

  it('cut wrapped in a history command is undoable (cut+undo restores)', () => {
    const cb = new Clipboard();
    const h = new History();
    const a = makeShape({ name: 'a' });
    const b = makeShape({ name: 'b' });
    const slide = makeSlide([a, b]);

    h.run(makeMutation('Cut', slide, (s) => void cb.cutElements(s, [a.id])));
    expect(slide.elements.map((el) => el.name)).toEqual(['b']);

    h.undo();
    expect(slide.elements.map((el) => el.name)).toEqual(['a', 'b']);
    expect(slide.elements[0].id).toBe(a.id);
    // Clipboard still holds the cut content, pasteable after undo.
    const [pasted] = cb.pasteElements(slide);
    expect(pasted.name).toBe('a');
    expect(pasted.id).not.toBe(a.id);
  });

  it('remaps line attachments to pasted counterparts', () => {
    const cb = new Clipboard();
    const box = makeShape();
    const donor = makeShape();
    const line = {
      id: 'line-src',
      name: 'Connector',
      type: 'line' as const,
      transform: donor.transform,
      hidden: false,
      locked: false,
      connector: 'straight' as const,
      line: donor.line,
      startAttachment: { elementId: box.id, site: 1 },
    };
    const slide = makeSlide();
    cb.copyElements([box, line]);
    const [pastedBox, pastedLine] = cb.pasteElements(slide);
    expect(pastedLine.type).toBe('line');
    if (pastedLine.type === 'line') {
      expect(pastedLine.startAttachment?.elementId).toBe(pastedBox.id);
    }
  });
});

describe('Clipboard: slides', () => {
  function deck() {
    const el1 = makeShape({ name: 'el1' });
    const el2 = makeShape({ name: 'el2' });
    const group = makeGroup([makeShape({ name: 'nested' })]);
    const slide1 = makeSlide([el1, group], {
      animations: [makeAnimation(el1.id), makeAnimation(group.children[0].id)],
    });
    const slide2 = makeSlide([el2]);
    const slide3 = makeSlide();
    return { pres: makePresentation([slide1, slide2, slide3]), slide1, slide2, slide3, el1, group };
  }

  it('pastes deep clones with new slide/element/animation ids', () => {
    const { pres, slide1 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide1.id]);
    const [pasted] = cb.pasteSlides(pres);

    expect(pasted.id).not.toBe(slide1.id);
    const originalIds = new Set(slide1.elements.flatMap((el) => collectIds(el)));
    for (const el of pasted.elements) {
      for (const id of collectIds(el)) expect(originalIds.has(id)).toBe(false);
    }
    const originalAnimIds = new Set(slide1.animations.map((a) => a.id));
    for (const anim of pasted.animations) expect(originalAnimIds.has(anim.id)).toBe(false);
  });

  it('remaps animation targetElementId to the new element ids', () => {
    const { pres, slide1 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide1.id]);
    const [pasted] = cb.pasteSlides(pres);

    const pastedElementIds = new Set(pasted.elements.flatMap((el) => collectIds(el)));
    expect(pasted.animations).toHaveLength(2);
    for (const anim of pasted.animations) {
      expect(pastedElementIds.has(anim.targetElementId)).toBe(true);
      // Not still pointing at the source slide's elements.
      const sourceIds = new Set(slide1.elements.flatMap((el) => collectIds(el)));
      expect(sourceIds.has(anim.targetElementId)).toBe(false);
    }
    // The nested-group-child target was remapped too.
    const groupChildAnim = pasted.animations[1];
    const pastedGroup = pasted.elements.find((el) => el.type === 'group');
    expect(pastedGroup?.type).toBe('group');
    if (pastedGroup?.type === 'group') {
      expect(groupChildAnim.targetElementId).toBe(pastedGroup.children[0].id);
    }
  });

  it('inserts after the copied slide by default', () => {
    const { pres, slide1 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide1.id]);
    const [pasted] = cb.pasteSlides(pres);
    expect(pres.slides).toHaveLength(4);
    expect(pres.slides[1]).toBe(pasted);
    expect(pres.slides[0].id).toBe(slide1.id);
  });

  it('inserts after the LAST copied slide when copying multiple', () => {
    const { pres, slide1, slide2 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide2.id, slide1.id]); // any order in
    const pasted = cb.pasteSlides(pres);
    expect(pasted).toHaveLength(2);
    // Copies keep presentation order and land after slide2 (index 1).
    expect(pres.slides.indexOf(pasted[0])).toBe(2);
    expect(pres.slides.indexOf(pasted[1])).toBe(3);
    expect(pasted[0].elements.some((el) => el.name === 'el1')).toBe(true);
  });

  it('inserts at an explicit index (clamped)', () => {
    const { pres, slide1 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide1.id]);
    const [atStart] = cb.pasteSlides(pres, 0);
    expect(pres.slides[0]).toBe(atStart);
    const [atEnd] = cb.pasteSlides(pres, 999);
    expect(pres.slides[pres.slides.length - 1]).toBe(atEnd);
  });

  it('repeated slide paste keeps minting fresh ids', () => {
    const { pres, slide1 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide1.id]);
    const [p1] = cb.pasteSlides(pres);
    const [p2] = cb.pasteSlides(pres);
    expect(p1.id).not.toBe(p2.id);
    const ids1 = p1.elements.flatMap((el) => collectIds(el));
    const ids2 = new Set(p2.elements.flatMap((el) => collectIds(el)));
    for (const id of ids1) expect(ids2.has(id)).toBe(false);
  });

  it('falls back to appending when the source slides were deleted', () => {
    const { pres, slide3 } = deck();
    const cb = new Clipboard();
    cb.copySlides(pres, [slide3.id]);
    pres.slides.splice(2, 1); // delete the source
    const [pasted] = cb.pasteSlides(pres);
    expect(pres.slides[pres.slides.length - 1]).toBe(pasted);
  });
});
