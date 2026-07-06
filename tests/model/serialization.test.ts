import { describe, expect, it } from 'vitest';
import type { Presentation } from '../../src/core/types';
import {
  addComment,
  addSection,
  addSlide,
  createPresentation,
  deserializePresentation,
  serializePresentation,
  setNotesText,
  setSlideBackground,
} from '../../src/model';

function richPresentation(): Presentation {
  const pres = createPresentation({ title: 'Round Trip', now: () => 42 });
  addSlide(pres);
  addSlide(pres);
  addSection(pres, 'Body', 1);
  setNotesText(pres, pres.slides[0].id, 'hello\nworld');
  setSlideBackground(pres, pres.slides[1].id, { type: 'solid', color: { type: 'rgb', value: '336699' } });
  addComment(pres, pres.slides[2].id, 'Ada', 'nice', { x: 5, y: 6 }, () => 7);
  return pres;
}

describe('serialization round trip', () => {
  it('is lossless for a rich presentation', () => {
    const pres = richPresentation();
    const json = serializePresentation(pres);
    expect(typeof json).toBe('string');
    const back = deserializePresentation(json);
    expect(back).toEqual(pres);
    // stable across a second round trip
    expect(serializePresentation(back)).toBe(json);
  });

  it('produces an independent object graph', () => {
    const pres = richPresentation();
    const back = deserializePresentation(serializePresentation(pres));
    back.slides[0].hidden = true;
    expect(pres.slides[0].hidden).toBe(false);
  });
});

describe('deserializePresentation validation', () => {
  const valid = () => JSON.parse(serializePresentation(createPresentation()));

  it('rejects garbage input', () => {
    expect(() => deserializePresentation('not json at all')).toThrow(/not valid JSON/);
    expect(() => deserializePresentation('42')).toThrow(/root must be an object/);
    expect(() => deserializePresentation('null')).toThrow(/root must be an object/);
    expect(() => deserializePresentation('[]')).toThrow(/root must be an object/);
    expect(() => deserializePresentation('{}')).toThrow(/Invalid presentation/);
  });

  it('rejects a wrong formatVersion', () => {
    const data = valid();
    data.formatVersion = 2;
    expect(() => deserializePresentation(JSON.stringify(data))).toThrow(/unsupported formatVersion 2/);
    delete data.formatVersion;
    expect(() => deserializePresentation(JSON.stringify(data))).toThrow(/formatVersion/);
  });

  it('rejects a missing or non-array slides collection', () => {
    const data = valid();
    delete data.slides;
    expect(() => deserializePresentation(JSON.stringify(data))).toThrow(/"slides" must be an array/);
    data.slides = 'oops';
    expect(() => deserializePresentation(JSON.stringify(data))).toThrow(/"slides" must be an array/);
  });

  it('rejects dangling layoutId references', () => {
    const data = valid();
    data.slides[0].layoutId = 'layout-missing';
    expect(() => deserializePresentation(JSON.stringify(data))).toThrow(
      /slide ".*" references missing layout "layout-missing"/,
    );
  });

  it('rejects dangling master/theme/section references', () => {
    const a = valid();
    a.layouts[0].masterId = 'ghost';
    expect(() => deserializePresentation(JSON.stringify(a))).toThrow(/references missing master "ghost"/);

    const b = valid();
    b.masters[0].themeId = 'ghost';
    expect(() => deserializePresentation(JSON.stringify(b))).toThrow(/references missing theme "ghost"/);

    const c = valid();
    c.defaultMasterId = 'ghost';
    expect(() => deserializePresentation(JSON.stringify(c))).toThrow(/defaultMasterId "ghost"/);

    const d = valid();
    d.sections = [{ id: 'sec-1', name: 'S', slideIds: ['no-such-slide'] }];
    expect(() => deserializePresentation(JSON.stringify(d))).toThrow(/references missing slide "no-such-slide"/);
  });

  it('rejects duplicate ids', () => {
    const pres = createPresentation();
    addSlide(pres);
    const dupSlides = JSON.parse(serializePresentation(pres));
    dupSlides.slides[1].id = dupSlides.slides[0].id;
    expect(() => deserializePresentation(JSON.stringify(dupSlides))).toThrow(/duplicate id/);

    const dupElements = JSON.parse(serializePresentation(pres));
    dupElements.slides[1].elements[0].id = dupElements.slides[0].elements[0].id;
    expect(() => deserializePresentation(JSON.stringify(dupElements))).toThrow(/duplicate id/);
  });

  it('rejects a slide claimed by two sections', () => {
    const pres = createPresentation();
    addSection(pres, 'A', 0);
    const data = JSON.parse(serializePresentation(pres));
    data.sections.push({ id: 'sec-dup', name: 'B', slideIds: [data.slides[0].id] });
    expect(() => deserializePresentation(JSON.stringify(data))).toThrow(/more than one section/);
  });
});
