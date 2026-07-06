import { describe, expect, it } from 'vitest';

import { SlideshowController } from '../../src/slideshow';
import type {
  Animation,
  Presentation,
  ShapeElement,
  Slide,
} from '../../src/core/types';
import {
  defaultEffects,
  defaultTextBody,
  defaultTransform,
  defaultTransition,
  noLine,
  textBodyOf,
} from '../../src/core/defaults';

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

function shape(id: string): ShapeElement {
  return {
    id,
    name: id,
    transform: defaultTransform(),
    hidden: false,
    locked: false,
    type: 'shape',
    geometry: 'rectangle',
    fill: { type: 'none' },
    line: noLine(),
    effects: defaultEffects(),
    textBody: defaultTextBody(),
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

describe('SlideshowController basics', () => {
  it('starts on the first visible slide with correct current() info', () => {
    const pres = makePresentation([
      makeSlide('s1', { animations: [anim(), anim()] }),
      makeSlide('s2'),
    ]);
    const show = new SlideshowController(pres);
    show.start();
    const info = show.current();
    expect(info.slide.id).toBe('s1');
    expect(info.slideNumber).toBe(1);
    expect(info.totalVisible).toBe(2);
    expect(info.pendingClickGroups).toBe(2);
    expect(show.finished).toBe(false);
  });

  it('supports startSlideId and rejects hidden/unknown start slides', () => {
    const pres = makePresentation([
      makeSlide('s1'),
      makeSlide('s2', { hidden: true }),
      makeSlide('s3'),
    ]);
    const show = new SlideshowController(pres, { startSlideId: 's3' });
    expect(show.current().slide.id).toBe('s3');
    expect(show.current().slideNumber).toBe(2); // second *visible* slide
    expect(() => new SlideshowController(pres, { startSlideId: 's2' })).toThrow();
    expect(() => new SlideshowController(pres, { startSlideId: 'nope' })).toThrow();
  });

  it('throws when there are no visible slides', () => {
    const pres = makePresentation([makeSlide('s1', { hidden: true })]);
    expect(() => new SlideshowController(pres)).toThrow();
  });
});

describe('next() and prev()', () => {
  function deck(): Presentation {
    return makePresentation([
      makeSlide('s1', {
        animations: [anim(), anim({ trigger: 'withPrevious' }), anim()], // 2 click groups
      }),
      makeSlide('s2', { hidden: true }),
      makeSlide('s3'),
      makeSlide('s4', { animations: [anim()] }), // 1 click group
    ]);
  }

  it('advances through click groups, then slides, skipping hidden slides', () => {
    const show = new SlideshowController(deck());
    show.start();
    expect(show.current().slide.id).toBe('s1');
    show.next(); // click group 1
    expect(show.current().slide.id).toBe('s1');
    expect(show.currentClickIndex).toBe(1);
    expect(show.current().pendingClickGroups).toBe(1);
    show.next(); // click group 2
    expect(show.current().pendingClickGroups).toBe(0);
    show.next(); // -> s3 (s2 hidden)
    expect(show.current().slide.id).toBe('s3');
    expect(show.currentClickIndex).toBe(0);
    show.next(); // -> s4
    expect(show.current().slide.id).toBe('s4');
    show.next(); // s4 click group
    expect(show.current().slide.id).toBe('s4');
    expect(show.finished).toBe(false);
    show.next(); // past the end
    expect(show.finished).toBe(true);
  });

  it('next() is a no-op once finished (no loop)', () => {
    const show = new SlideshowController(makePresentation([makeSlide('s1')]));
    show.start();
    show.next();
    expect(show.finished).toBe(true);
    show.next();
    show.next();
    expect(show.finished).toBe(true);
    expect(show.current().slide.id).toBe('s1');
  });

  it('prev() steps back through click groups then to the previous slide fully played', () => {
    const show = new SlideshowController(deck());
    show.start();
    show.next();
    show.next();
    show.next(); // on s3
    expect(show.current().slide.id).toBe('s3');
    show.prev(); // back to s1 with both groups played (PowerPoint behavior)
    expect(show.current().slide.id).toBe('s1');
    expect(show.currentClickIndex).toBe(2);
    expect(show.current().pendingClickGroups).toBe(0);
    show.prev();
    expect(show.currentClickIndex).toBe(1);
    show.prev();
    expect(show.currentClickIndex).toBe(0);
    show.prev(); // at the very start: no-op
    expect(show.current().slide.id).toBe('s1');
    expect(show.currentClickIndex).toBe(0);
  });

  it('next then prev returns to the same state (symmetry)', () => {
    const show = new SlideshowController(deck());
    show.start();
    // Walk forward, checking prev undoes each next.
    for (let step = 0; step < 5; step++) {
      const before = {
        slideIndex: show.currentSlideIndex,
        clickIndex: show.currentClickIndex,
        finished: show.finished,
      };
      show.next();
      show.prev();
      expect(show.currentSlideIndex, `step ${step}`).toBe(before.slideIndex);
      expect(show.currentClickIndex, `step ${step}`).toBe(before.clickIndex);
      expect(show.finished, `step ${step}`).toBe(before.finished);
      show.next();
    }
  });

  it('prev() from the finished state returns to the last slide fully played', () => {
    const show = new SlideshowController(
      makePresentation([makeSlide('s1'), makeSlide('s2', { animations: [anim()] })]),
    );
    show.start();
    show.next(); // s2
    show.next(); // s2 group played
    show.next(); // finished
    expect(show.finished).toBe(true);
    show.prev();
    expect(show.finished).toBe(false);
    expect(show.current().slide.id).toBe('s2');
    expect(show.currentClickIndex).toBe(1);
  });
});

describe('kiosk loop mode', () => {
  it('wraps to the first slide instead of finishing', () => {
    const pres = makePresentation([makeSlide('s1'), makeSlide('s2', { animations: [anim()] })]);
    const show = new SlideshowController(pres, { loop: true });
    show.start();
    show.next(); // s2
    show.next(); // s2 click group
    show.next(); // wrap -> s1
    expect(show.current().slide.id).toBe('s1');
    expect(show.currentClickIndex).toBe(0);
    expect(show.finished).toBe(false);
    show.next(); // s2 again
    expect(show.current().slide.id).toBe('s2');
    expect(show.finished).toBe(false);
  });
});

describe('goTo / firstSlide / lastSlide / end', () => {
  const pres = () =>
    makePresentation([
      makeSlide('s1'),
      makeSlide('s2', { hidden: true }),
      makeSlide('s3', { animations: [anim()] }),
      makeSlide('s4'),
    ]);

  it('goTo accepts a slide id or 1-based visible number and resets clicks', () => {
    const show = new SlideshowController(pres());
    show.start();
    show.goTo('s3');
    expect(show.current().slide.id).toBe('s3');
    expect(show.current().slideNumber).toBe(2);
    show.next();
    expect(show.currentClickIndex).toBe(1);
    show.goTo(2); // visible #2 is s3 again -> click index resets
    expect(show.current().slide.id).toBe('s3');
    expect(show.currentClickIndex).toBe(0);
    show.goTo(3);
    expect(show.current().slide.id).toBe('s4');
  });

  it('goTo throws for hidden slides and out-of-range numbers', () => {
    const show = new SlideshowController(pres());
    expect(() => show.goTo('s2')).toThrow();
    expect(() => show.goTo('unknown')).toThrow();
    expect(() => show.goTo(0)).toThrow();
    expect(() => show.goTo(4)).toThrow(); // only 3 visible slides
  });

  it('goTo clears the finished flag', () => {
    const show = new SlideshowController(pres());
    show.end();
    expect(show.finished).toBe(true);
    show.goTo(1);
    expect(show.finished).toBe(false);
  });

  it('firstSlide/lastSlide jump within visible slides; end() finishes', () => {
    const show = new SlideshowController(pres());
    show.lastSlide();
    expect(show.current().slide.id).toBe('s4');
    show.firstSlide();
    expect(show.current().slide.id).toBe('s1');
    show.end();
    expect(show.finished).toBe(true);
    show.next();
    expect(show.current().slide.id).toBe('s1'); // no-op after end
  });
});

describe('visibleAnimationsState', () => {
  it('elements with pending entrances are hidden until their group plays', () => {
    const slide = makeSlide('s1', {
      elements: [shape('title'), shape('bullet1'), shape('bullet2')],
      animations: [
        anim({ targetElementId: 'bullet1', category: 'entrance' }),
        anim({ targetElementId: 'bullet2', category: 'entrance' }),
      ],
    });
    const show = new SlideshowController(makePresentation([slide]));
    show.start();

    let state = show.visibleAnimationsState();
    expect(state.visible).toEqual(['title']);
    expect(state.hidden.sort()).toEqual(['bullet1', 'bullet2']);

    show.next();
    state = show.visibleAnimationsState();
    expect(state.visible.sort()).toEqual(['bullet1', 'title']);
    expect(state.hidden).toEqual(['bullet2']);

    show.next();
    state = show.visibleAnimationsState();
    expect(state.visible.sort()).toEqual(['bullet1', 'bullet2', 'title']);
    expect(state.hidden).toEqual([]);
  });

  it('a played exit hides the element; emphasis does not affect visibility', () => {
    const slide = makeSlide('s1', {
      elements: [shape('a'), shape('b')],
      animations: [
        anim({ targetElementId: 'a', category: 'emphasis', effect: 'pulse' }),
        anim({ targetElementId: 'a', category: 'exit', effect: 'flyOut' }),
      ],
    });
    const show = new SlideshowController(makePresentation([slide]));
    show.start();

    // No entrance animations: everything visible from the start.
    expect(show.visibleAnimationsState().visible.sort()).toEqual(['a', 'b']);

    show.next(); // emphasis played
    expect(show.visibleAnimationsState().visible.sort()).toEqual(['a', 'b']);

    show.next(); // exit played
    const state = show.visibleAnimationsState();
    expect(state.hidden).toEqual(['a']);
    expect(state.visible).toEqual(['b']);
  });

  it('entrance -> exit -> entrance combo follows play order', () => {
    const slide = makeSlide('s1', {
      elements: [shape('x')],
      animations: [
        anim({ targetElementId: 'x', category: 'entrance' }),
        anim({ targetElementId: 'x', category: 'exit', effect: 'flyOut' }),
        anim({ targetElementId: 'x', category: 'entrance', effect: 'zoom' }),
      ],
    });
    const show = new SlideshowController(makePresentation([slide]));
    show.start();
    expect(show.visibleAnimationsState().hidden).toEqual(['x']); // has entrance, not played
    show.next();
    expect(show.visibleAnimationsState().visible).toEqual(['x']);
    show.next();
    expect(show.visibleAnimationsState().hidden).toEqual(['x']);
    show.next();
    expect(show.visibleAnimationsState().visible).toEqual(['x']);
  });

  it('withPrevious entrances play together with their group leader', () => {
    const slide = makeSlide('s1', {
      elements: [shape('a'), shape('b')],
      animations: [
        anim({ targetElementId: 'a', category: 'entrance' }),
        anim({ targetElementId: 'b', category: 'entrance', trigger: 'withPrevious' }),
      ],
    });
    const show = new SlideshowController(makePresentation([slide]));
    show.start();
    expect(show.visibleAnimationsState().hidden.sort()).toEqual(['a', 'b']);
    show.next(); // one click plays both (same group)
    expect(show.visibleAnimationsState().visible.sort()).toEqual(['a', 'b']);
  });
});

describe('autoAdvanceDelay / notesForCurrent', () => {
  it('returns advanceAfter or null', () => {
    const pres = makePresentation([
      makeSlide('s1', { transition: defaultTransition({ advanceAfter: 5000 }) }),
      makeSlide('s2'),
    ]);
    const show = new SlideshowController(pres);
    show.start();
    expect(show.autoAdvanceDelay()).toBe(5000);
    show.next();
    expect(show.autoAdvanceDelay()).toBeNull();
  });

  it('concatenates note paragraphs with newlines', () => {
    const notes = textBodyOf('First line');
    notes.paragraphs.push(
      {
        ...notes.paragraphs[0],
        children: [
          { type: 'run', text: 'Second ', font: notes.paragraphs[0].children[0] as never },
          { type: 'run', text: 'line', font: notes.paragraphs[0].children[0] as never },
        ],
      },
    );
    const slide = makeSlide('s1', { notes: textBodyOf('') });
    slide.notes = {
      ...defaultTextBody(),
      paragraphs: [
        {
          children: [{ type: 'run', text: 'First line', font: undefined as never }],
          align: 'left',
          level: 0,
          bullet: { type: 'none' },
          lineSpacing: 1,
          spaceBefore: 0,
          spaceAfter: 0,
          indent: 0,
        },
        {
          children: [
            { type: 'run', text: 'Second ', font: undefined as never },
            { type: 'run', text: 'line', font: undefined as never },
          ],
          align: 'left',
          level: 0,
          bullet: { type: 'none' },
          lineSpacing: 1,
          spaceBefore: 0,
          spaceAfter: 0,
          indent: 0,
        },
      ],
    };
    const show = new SlideshowController(makePresentation([slide]));
    show.start();
    expect(show.notesForCurrent()).toBe('First line\nSecond line');
  });

  it('renders explicit line breaks in notes as newlines', () => {
    const slide = makeSlide('s1');
    slide.notes = {
      ...defaultTextBody(),
      paragraphs: [
        {
          children: [
            { type: 'run', text: 'Before', font: undefined as never },
            { type: 'break' },
            { type: 'run', text: 'After', font: undefined as never },
          ],
          align: 'left',
          level: 0,
          bullet: { type: 'none' },
          lineSpacing: 1,
          spaceBefore: 0,
          spaceAfter: 0,
          indent: 0,
        },
      ],
    };
    const show = new SlideshowController(makePresentation([slide]));
    show.start();
    expect(show.notesForCurrent()).toBe('Before\nAfter');
  });
});
