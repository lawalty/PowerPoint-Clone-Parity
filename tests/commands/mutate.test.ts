import { describe, it, expect } from 'vitest';
import {
  History,
  makeMutation,
  restoreInPlace,
  slideMutation,
  presentationMutation,
} from '../../src/commands';
import { makePresentation, makeShape, makeSlide } from './helpers';

describe('makeMutation', () => {
  it('captures before/after and supports undo/redo', () => {
    const target = { count: 1, tags: ['a'] };
    const h = new History();
    const cmd = makeMutation('Bump', target, (t) => {
      t.count = 2;
      t.tags.push('b');
    });
    h.run(cmd);
    expect(target.count).toBe(2);
    expect(target.tags).toEqual(['a', 'b']);

    h.undo();
    expect(target.count).toBe(1);
    expect(target.tags).toEqual(['a']);

    h.redo();
    expect(target.count).toBe(2);
    expect(target.tags).toEqual(['a', 'b']);
  });

  it('redo restores the after snapshot instead of re-running the mutator', () => {
    const target = { count: 0 };
    let calls = 0;
    const h = new History();
    h.run(
      makeMutation('Inc', target, (t) => {
        calls++;
        t.count++;
      }),
    );
    h.undo();
    h.redo();
    h.undo();
    h.redo();
    expect(calls).toBe(1);
    expect(target.count).toBe(1);
  });

  it('supports a custom scoped snapshot/restore', () => {
    const target = { title: 'old', big: { untouched: true } };
    const h = new History();
    const cmd = makeMutation<typeof target, string>(
      'Rename',
      target,
      (t) => {
        t.title = 'new';
      },
      {
        snapshot: (t) => t.title,
        restore: (t, s) => {
          t.title = s;
        },
      },
    );
    const bigRef = target.big;
    h.run(cmd);
    expect(target.title).toBe('new');
    h.undo();
    expect(target.title).toBe('old');
    expect(target.big).toBe(bigRef); // scoped restore never touched it
  });
});

describe('restoreInPlace', () => {
  it('splices arrays in place preserving array identity', () => {
    const target = { list: [1, 2, 3] };
    const listRef = target.list;
    restoreInPlace(target, { list: [9] });
    expect(target.list).toBe(listRef);
    expect(target.list).toEqual([9]);
  });

  it('deletes keys absent from the snapshot and adds new ones', () => {
    const target: Record<string, unknown> = { keep: 1, drop: 2 };
    restoreInPlace(target, { keep: 1, added: 3 });
    expect(target).toEqual({ keep: 1, added: 3 });
    expect('drop' in target).toBe(false);
  });

  it('preserves nested object identity', () => {
    const target = { nested: { value: 1 } };
    const nestedRef = target.nested;
    restoreInPlace(target, { nested: { value: 42 } });
    expect(target.nested).toBe(nestedRef);
    expect(target.nested.value).toBe(42);
  });
});

describe('slideMutation / presentationMutation', () => {
  it('slideMutation restores in place: external references see the restored state', () => {
    const shape = makeShape();
    const slide = makeSlide([shape]);
    const pres = makePresentation([slide]);
    const h = new History();

    const slideRef = slide; // external reference
    const elementsRef = slide.elements;

    h.run(
      slideMutation(pres, slide.id, 'Move Shape', (s) => {
        s.elements[0].transform.x = 500;
        s.elements.push(makeShape());
      }),
    );
    expect(slideRef.elements[0].transform.x).toBe(500);
    expect(elementsRef.length).toBe(2);

    h.undo();
    // Same slide object and same elements array, contents restored.
    expect(pres.slides[0]).toBe(slideRef);
    expect(slideRef.elements).toBe(elementsRef);
    expect(elementsRef.length).toBe(1);
    expect(slideRef.elements[0].transform.x).toBe(10);

    h.redo();
    expect(elementsRef.length).toBe(2);
    expect(slideRef.elements[0].transform.x).toBe(500);
  });

  it('slideMutation throws for an unknown slide id', () => {
    const pres = makePresentation([makeSlide()]);
    expect(() => slideMutation(pres, 'nope', 'x', () => {})).toThrow(/not found/);
  });

  it('slideMutation only snapshots its slide (other slides keep identity)', () => {
    const slideA = makeSlide([makeShape()]);
    const slideB = makeSlide([makeShape()]);
    const pres = makePresentation([slideA, slideB]);
    const h = new History();
    const bRef = pres.slides[1];

    h.run(
      slideMutation(pres, slideA.id, 'Edit A', (s) => {
        s.hidden = true;
      }),
    );
    h.undo();
    expect(pres.slides[1]).toBe(bRef);
    expect(slideA.hidden).toBe(false);
  });

  it('presentationMutation restores in place so external refs to pres stay valid', () => {
    const pres = makePresentation([makeSlide(), makeSlide()]);
    const h = new History();
    const presRef = pres;
    const propsRef = pres.properties;
    const slidesRef = pres.slides;

    h.run(
      presentationMutation(pres, 'Retitle + Remove Slide', (p) => {
        p.properties.title = 'Changed';
        p.slides.splice(1, 1);
      }),
    );
    expect(presRef.properties.title).toBe('Changed');
    expect(slidesRef.length).toBe(1);

    h.undo();
    expect(presRef.properties).toBe(propsRef);
    expect(presRef.slides).toBe(slidesRef);
    expect(propsRef.title).toBe('Test Deck');
    expect(slidesRef.length).toBe(2);
  });

  it('mutation commands compose inside a transaction', () => {
    const slide = makeSlide([makeShape()]);
    const pres = makePresentation([slide]);
    const h = new History();

    h.transact('Style + Move', () => {
      h.run(
        slideMutation(pres, slide.id, 'Move', (s) => {
          s.elements[0].transform.x = 111;
        }),
      );
      h.run(
        slideMutation(pres, slide.id, 'Hide', (s) => {
          s.elements[0].hidden = true;
        }),
      );
    });
    expect(slide.elements[0].transform.x).toBe(111);
    expect(slide.elements[0].hidden).toBe(true);
    expect(h.undoLabel).toBe('Style + Move');

    h.undo();
    expect(slide.elements[0].transform.x).toBe(10);
    expect(slide.elements[0].hidden).toBe(false);
  });
});
