import { describe, expect, it } from 'vitest';
import {
  effectiveElements,
  getLayout,
  getMaster,
  getTheme,
  resolvePlaceholderDefaults,
  resolveSlideBackground,
} from '../../src/style';
import type { Fill, ShapeElement } from '../../src/core/types';
import { defaultTransform } from '../../src/core/defaults';
import { makePresentation, picture, shape } from './fixtures';

describe('getLayout / getMaster / getTheme', () => {
  it('walks the chain slide -> layout -> master -> theme', () => {
    const pres = makePresentation();
    const layout = getLayout(pres, pres.slides[0]);
    expect(layout?.id).toBe('l1');
    const master = getMaster(pres, layout!);
    expect(master?.id).toBe('m1');
    const theme = getTheme(pres, master!);
    expect(theme?.id).toBe('th1');
  });

  it('returns undefined for dangling references', () => {
    const pres = makePresentation({ slide: { layoutId: 'missing' } });
    expect(getLayout(pres, pres.slides[0])).toBeUndefined();
  });
});

describe('resolveSlideBackground', () => {
  const slideBg: Fill = { type: 'solid', color: { type: 'rgb', value: '111111' } };
  const layoutBg: Fill = { type: 'solid', color: { type: 'rgb', value: '222222' } };

  it('slide background wins over layout and master', () => {
    const pres = makePresentation({ slide: { background: slideBg }, layout: { background: layoutBg } });
    expect(resolveSlideBackground(pres, pres.slides[0])).toEqual(slideBg);
  });

  it('falls through to the layout background when the slide has none', () => {
    const pres = makePresentation({ layout: { background: layoutBg } });
    expect(resolveSlideBackground(pres, pres.slides[0])).toEqual(layoutBg);
  });

  it('falls through to the master background when slide and layout have none', () => {
    const pres = makePresentation();
    expect(resolveSlideBackground(pres, pres.slides[0])).toEqual({
      type: 'solid',
      color: { type: 'theme', slot: 'dark2' },
    });
  });

  it('clearing a slide override re-exposes the inherited background', () => {
    const pres = makePresentation({ slide: { background: slideBg }, layout: { background: layoutBg } });
    const slide = pres.slides[0];
    delete slide.background;
    expect(resolveSlideBackground(pres, slide)).toEqual(layoutBg);
  });
});

describe('resolvePlaceholderDefaults', () => {
  function titlePlaceholderOnSlide(): ShapeElement {
    return shape('sl-title', {
      placeholder: { kind: 'title', index: 0 },
      transform: defaultTransform({ x: 99, y: 99, width: 500, height: 80 }),
    });
  }

  it("the slide element's own transform wins", () => {
    const pres = makePresentation();
    const el = titlePlaceholderOnSlide();
    const defaults = resolvePlaceholderDefaults(pres, pres.slides[0], el);
    expect(defaults.transform).toEqual(el.transform);
  });

  it('layout placeholder text defaults win over master (via a text-less picture placeholder)', () => {
    const pres = makePresentation();
    // Picture elements have no textBody, so the inherited one must be used.
    const el = picture('sl-pic', { placeholder: { kind: 'title', index: 0 } });
    const defaults = resolvePlaceholderDefaults(pres, pres.slides[0], el);
    // Layout title run is size 40; master title run is size 44.
    const run = defaults.textBody!.paragraphs[0].children[0];
    expect(run.type).toBe('run');
    if (run.type === 'run') expect(run.font.size).toBe(40);
    expect(defaults.transform).toEqual(el.transform); // element still wins for transform
  });

  it('falls back to the master placeholder when the layout has no match', () => {
    const pres = makePresentation();
    const layout = pres.layouts[0];
    layout.elements = layout.elements.filter((e) => !e.placeholder);
    const el = picture('sl-pic', { placeholder: { kind: 'title', index: 0 } });
    const defaults = resolvePlaceholderDefaults(pres, pres.slides[0], el);
    const run = defaults.textBody!.paragraphs[0].children[0];
    if (run.type === 'run') expect(run.font.size).toBe(44);
    else throw new Error('expected run');
  });

  it('matches by index when the kind differs', () => {
    const pres = makePresentation();
    const el = picture('sl-pic', { placeholder: { kind: 'centeredTitle', index: 0 } });
    const defaults = resolvePlaceholderDefaults(pres, pres.slides[0], el);
    const run = defaults.textBody!.paragraphs[0].children[0];
    if (run.type === 'run') expect(run.font.size).toBe(40); // matched layout title by index
    else throw new Error('expected run');
  });

  it('matches by kind when the index differs', () => {
    const pres = makePresentation();
    const el = picture('sl-pic', { placeholder: { kind: 'title', index: 42 } });
    const defaults = resolvePlaceholderDefaults(pres, pres.slides[0], el);
    const run = defaults.textBody!.paragraphs[0].children[0];
    if (run.type === 'run') expect(run.font.size).toBe(40);
    else throw new Error('expected run');
  });

  it('returns no textBody when nothing in the chain provides one', () => {
    const pres = makePresentation();
    pres.layouts[0].elements = [];
    pres.masters[0].elements = [];
    const el = picture('sl-pic', { placeholder: { kind: 'picture', index: 7 } });
    const defaults = resolvePlaceholderDefaults(pres, pres.slides[0], el);
    expect(defaults.textBody).toBeUndefined();
    expect(defaults.transform).toEqual(el.transform);
  });
});

describe('effectiveElements', () => {
  it('layers master decorations, layout decorations, then slide elements', () => {
    const el = shape('sl-el');
    const pres = makePresentation({ slide: { elements: [el] } });
    const ids = effectiveElements(pres, pres.slides[0]).map((e) => e.id);
    expect(ids).toEqual(['m-deco', 'l-deco', 'sl-el']);
  });

  it('excludes master/layout placeholders from the render list', () => {
    const pres = makePresentation();
    const ids = effectiveElements(pres, pres.slides[0]).map((e) => e.id);
    expect(ids).not.toContain('m-title');
    expect(ids).not.toContain('m-body');
    expect(ids).not.toContain('l-title');
  });

  it('hideBackgroundGraphics drops master and layout decorations', () => {
    const el = shape('sl-el');
    const pres = makePresentation({ slide: { elements: [el], hideBackgroundGraphics: true } });
    const ids = effectiveElements(pres, pres.slides[0]).map((e) => e.id);
    expect(ids).toEqual(['sl-el']);
  });

  it('skips hidden decorations', () => {
    const pres = makePresentation();
    const deco = pres.masters[0].elements.find((e) => e.id === 'm-deco')!;
    deco.hidden = true;
    const ids = effectiveElements(pres, pres.slides[0]).map((e) => e.id);
    expect(ids).toEqual(['l-deco']);
  });
});
