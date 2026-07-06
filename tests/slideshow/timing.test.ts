import { describe, expect, it } from 'vitest';

import { estimateSlideshowDuration } from '../../src/slideshow';
import type { Animation, Presentation, Slide } from '../../src/core/types';
import { defaultTextBody, defaultTransition } from '../../src/core/defaults';

let counter = 0;
function anim(overrides: Partial<Animation> = {}): Animation {
  counter += 1;
  return {
    id: `a${counter}`,
    targetElementId: 'el-1',
    category: 'entrance',
    effect: 'fade',
    trigger: 'onClick',
    delay: 0,
    duration: 500,
    repeat: 1,
    ...overrides,
  };
}

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

describe('estimateSlideshowDuration', () => {
  it('budgets the default per click: click groups + 1 per slide', () => {
    const pres = makePresentation([
      makeSlide('s1'), // 0 groups -> 1 click -> 3000
      makeSlide('s2', {
        animations: [anim(), anim({ trigger: 'afterPrevious' }), anim()], // 2 groups -> 3 clicks
      }),
    ]);
    expect(estimateSlideshowDuration(pres)).toBe(3000 + 3 * 3000);
  });

  it('uses advanceAfter when set, regardless of click groups', () => {
    const pres = makePresentation([
      makeSlide('s1', {
        transition: defaultTransition({ advanceAfter: 7500 }),
        animations: [anim(), anim()],
      }),
      makeSlide('s2'),
    ]);
    expect(estimateSlideshowDuration(pres)).toBe(7500 + 3000);
  });

  it('respects advanceAfter of 0 and a custom default', () => {
    const pres = makePresentation([
      makeSlide('s1', { transition: defaultTransition({ advanceAfter: 0 }) }),
      makeSlide('s2', { animations: [anim()] }), // 2 clicks
    ]);
    expect(estimateSlideshowDuration(pres, 1000)).toBe(0 + 2000);
  });

  it('skips hidden slides and handles an empty presentation', () => {
    const pres = makePresentation([
      makeSlide('s1'),
      makeSlide('s2', { hidden: true, transition: defaultTransition({ advanceAfter: 60000 }) }),
    ]);
    expect(estimateSlideshowDuration(pres)).toBe(3000);
    expect(estimateSlideshowDuration(makePresentation([]))).toBe(0);
  });
});
