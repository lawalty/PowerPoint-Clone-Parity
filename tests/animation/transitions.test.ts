import { describe, expect, it } from 'vitest';

import {
  applyTransitionToAll,
  setTransition,
  transitionCatalog,
  transitionMeta,
  validateTransition,
} from '../../src/animation';
import type { Presentation, Slide, Transition, TransitionKind } from '../../src/core/types';
import { defaultTextBody, defaultTransition } from '../../src/core/defaults';

// Record keyed by TransitionKind: the compiler forces this list to stay in
// sync with the union type — adding/removing a kind breaks this test file.
const KIND_RECORD: Record<TransitionKind, true> = {
  none: true,
  fade: true,
  push: true,
  wipe: true,
  split: true,
  reveal: true,
  cut: true,
  random: true,
  shape: true,
  uncover: true,
  cover: true,
  flash: true,
  dissolve: true,
  checkerboard: true,
  blinds: true,
  zoom: true,
  morph: true,
};
const ALL_KINDS = Object.keys(KIND_RECORD) as TransitionKind[];

function makeSlide(id: string, overrides: Partial<Slide> = {}): Slide {
  return {
    id,
    layoutId: 'layout-1',
    elements: [],
    transition: defaultTransition(),
    animations: [],
    notes: defaultTextBody(),
    comments: [],
    hidden: false,
    hideBackgroundGraphics: false,
    ...overrides,
  };
}

function makePresentation(slides: Slide[]): Presentation {
  return {
    id: 'pres-1',
    formatVersion: 1,
    properties: {
      title: 'Deck',
      author: 'Tester',
      subject: '',
      createdAt: 0,
      modifiedAt: 0,
      revision: 1,
    },
    slideSize: { width: 960, height: 540 },
    slides,
    sections: [],
    masters: [],
    layouts: [],
    themes: [],
    defaultMasterId: 'master-1',
  };
}

describe('transitionCatalog', () => {
  it('contains an entry for every TransitionKind and nothing else', () => {
    const catalog = transitionCatalog();
    const kinds = catalog.map((m) => m.kind).sort();
    expect(kinds).toEqual([...ALL_KINDS].sort());
    expect(catalog).toHaveLength(ALL_KINDS.length);
  });

  it('every entry has a non-empty label and a non-negative default duration', () => {
    for (const meta of transitionCatalog()) {
      expect(meta.label.length, meta.kind).toBeGreaterThan(0);
      expect(meta.defaultDuration, meta.kind).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(meta.supportsDirection), meta.kind).toBe(true);
    }
  });

  it('instant kinds default to 0 duration; animated kinds are positive', () => {
    for (const meta of transitionCatalog()) {
      if (meta.kind === 'none' || meta.kind === 'cut') {
        expect(meta.defaultDuration, meta.kind).toBe(0);
      } else {
        expect(meta.defaultDuration, meta.kind).toBeGreaterThan(0);
      }
    }
  });

  it('directional kinds expose their valid directions', () => {
    expect(transitionMeta('push').supportsDirection).toEqual(
      expect.arrayContaining(['left', 'right', 'up', 'down']),
    );
    expect(transitionMeta('zoom').supportsDirection).toEqual(expect.arrayContaining(['in', 'out']));
    expect(transitionMeta('blinds').supportsDirection).toEqual(
      expect.arrayContaining(['horizontal', 'vertical']),
    );
    expect(transitionMeta('fade').supportsDirection).toEqual([]);
    expect(transitionMeta('none').supportsDirection).toEqual([]);
  });

  it('returns fresh copies (mutating the result does not corrupt the catalog)', () => {
    const first = transitionCatalog();
    const pushMeta = first.find((m) => m.kind === 'push')!;
    pushMeta.label = 'CORRUPTED';
    pushMeta.supportsDirection.push('in');
    const second = transitionCatalog().find((m) => m.kind === 'push')!;
    expect(second.label).toBe('Push');
    expect(second.supportsDirection).not.toContain('in');
  });
});

describe('validateTransition', () => {
  it('accepts every kind with its default duration and each supported direction', () => {
    for (const meta of transitionCatalog()) {
      const base: Transition = {
        kind: meta.kind,
        duration: meta.defaultDuration,
        advanceOnClick: true,
      };
      expect(() => validateTransition(base), meta.kind).not.toThrow();
      for (const dir of meta.supportsDirection) {
        expect(() => validateTransition({ ...base, direction: dir })).not.toThrow();
      }
    }
  });

  it('throws on a direction the kind does not support', () => {
    expect(() =>
      validateTransition({ kind: 'fade', duration: 700, direction: 'left', advanceOnClick: true }),
    ).toThrow(/direction/);
    expect(() =>
      validateTransition({ kind: 'push', duration: 500, direction: 'in', advanceOnClick: true }),
    ).toThrow(/direction/);
    expect(() =>
      validateTransition({ kind: 'zoom', duration: 800, direction: 'up', advanceOnClick: true }),
    ).toThrow(/direction/);
  });

  it('throws on non-positive duration, except duration 0 for none/cut', () => {
    expect(() =>
      validateTransition({ kind: 'fade', duration: 0, advanceOnClick: true }),
    ).toThrow(/duration/);
    expect(() =>
      validateTransition({ kind: 'wipe', duration: -100, advanceOnClick: true }),
    ).toThrow(/duration/);
    expect(() =>
      validateTransition({ kind: 'none', duration: 0, advanceOnClick: true }),
    ).not.toThrow();
    expect(() =>
      validateTransition({ kind: 'cut', duration: 0, advanceOnClick: true }),
    ).not.toThrow();
    expect(() =>
      validateTransition({ kind: 'cut', duration: -1, advanceOnClick: true }),
    ).toThrow(/duration/);
  });

  it('throws on a negative advanceAfter', () => {
    expect(() =>
      validateTransition({ kind: 'fade', duration: 500, advanceAfter: -1, advanceOnClick: true }),
    ).toThrow(/advanceAfter/);
  });
});

describe('setTransition', () => {
  it('merges a patch into the slide transition and returns it', () => {
    const slide = makeSlide('s1');
    const result = setTransition(slide, { kind: 'push', direction: 'left', duration: 800 });
    expect(slide.transition.kind).toBe('push');
    expect(slide.transition.direction).toBe('left');
    expect(slide.transition.duration).toBe(800);
    expect(slide.transition.advanceOnClick).toBe(true); // preserved from default
    expect(result).toBe(slide.transition);
  });

  it('rejects an invalid patch and leaves the slide unchanged', () => {
    const slide = makeSlide('s1');
    const before = { ...slide.transition };
    expect(() => setTransition(slide, { kind: 'fade', direction: 'left' })).toThrow();
    expect(slide.transition).toEqual(before);
    expect(() => setTransition(slide, { kind: 'fade', duration: 0 })).toThrow();
    expect(slide.transition).toEqual(before);
  });
});

describe('applyTransitionToAll', () => {
  it('applies a deep clone of the transition to every slide', () => {
    const pres = makePresentation([makeSlide('s1'), makeSlide('s2'), makeSlide('s3')]);
    const transition: Transition = {
      kind: 'wipe',
      duration: 1200,
      direction: 'right',
      advanceOnClick: true,
    };
    applyTransitionToAll(pres, transition);
    for (const slide of pres.slides) {
      expect(slide.transition).toEqual(transition);
      expect(slide.transition).not.toBe(transition);
    }
    // Clones are independent per slide.
    pres.slides[0].transition.duration = 1;
    expect(pres.slides[1].transition.duration).toBe(1200);
  });

  it('validates before applying anything', () => {
    const pres = makePresentation([makeSlide('s1'), makeSlide('s2')]);
    expect(() =>
      applyTransitionToAll(pres, {
        kind: 'reveal',
        duration: 500,
        direction: 'up',
        advanceOnClick: true,
      }),
    ).toThrow(/direction/);
    expect(pres.slides[0].transition.kind).toBe('none');
    expect(pres.slides[1].transition.kind).toBe('none');
  });
});
