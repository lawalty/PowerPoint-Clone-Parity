import { describe, expect, it } from 'vitest';
import { paragraphOf, textBodyOf } from '../../src/core/defaults';
import { addSlide, findLayoutByKind } from '../../src/model';
import { createShape } from '../../src/shapes';
import { renderSlideSVG } from '../../src/render';
import {
  exportAllSVGs,
  exportJSON,
  exportOutlineText,
  exportPresentationHTML,
  exportSlideSVG,
  importJSON,
} from '../../src/export';
import { blankSlide, newPres, slideWith, wellFormedError } from '../render/helpers';

describe('exportPresentationHTML', () => {
  it('embeds the title and one section per visible slide', () => {
    const pres = newPres('Quarterly Review & Plan');
    blankSlide(pres);
    blankSlide(pres);
    const html = exportPresentationHTML(pres);
    expect(html).toContain('<title>Quarterly Review &amp; Plan</title>');
    expect(html).toContain('<h1>Quarterly Review &amp; Plan</h1>');
    expect((html.match(/<section class="slide/g) ?? []).length).toBe(3);
    expect((html.match(/<svg /g) ?? []).length).toBe(3);
  });

  it('excludes hidden slides', () => {
    const pres = newPres();
    const hidden = blankSlide(pres);
    hidden.hidden = true;
    const html = exportPresentationHTML(pres);
    expect((html.match(/<section class="slide/g) ?? []).length).toBe(1);
  });

  it('is self-contained with inline navigation script and styles', () => {
    const pres = newPres();
    const html = exportPresentationHTML(pres);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<script>');
    expect(html).toContain('<style>');
    expect(html).toContain('id="prev-slide"');
    expect(html).toContain('id="next-slide"');
    // No external resources.
    expect(html).not.toMatch(/src="http/);
    expect(html).not.toMatch(/<link /);
  });

  it('marks the first slide active', () => {
    const pres = newPres();
    blankSlide(pres);
    const html = exportPresentationHTML(pres);
    expect(html).toContain('class="slide active" data-slide="1"');
    expect(html).toContain('class="slide" data-slide="2"');
  });
});

describe('exportSlideSVG / exportAllSVGs', () => {
  it('exports the slide at the given index', () => {
    const pres = newPres();
    const slide = slideWith(pres, createShape('hexagon', { x: 10, y: 10 }));
    const svg = exportSlideSVG(pres, 1);
    expect(svg).toBe(renderSlideSVG(pres, slide));
    expect(svg).toContain('<polygon');
    expect(wellFormedError(svg)).toBeNull();
  });

  it('throws a RangeError for out-of-range indices', () => {
    const pres = newPres();
    expect(() => exportSlideSVG(pres, -1)).toThrow(RangeError);
    expect(() => exportSlideSVG(pres, 1)).toThrow(RangeError);
    expect(() => exportSlideSVG(pres, 0.5)).toThrow(RangeError);
  });

  it('exportAllSVGs returns one svg per visible slide, in order', () => {
    const pres = newPres();
    const second = blankSlide(pres);
    const hidden = blankSlide(pres);
    hidden.hidden = true;
    const svgs = exportAllSVGs(pres);
    expect(svgs).toHaveLength(2);
    expect(svgs[1]).toBe(renderSlideSVG(pres, second));
    for (const svg of svgs) {
      expect(wellFormedError(svg)).toBeNull();
    }
  });
});

describe('exportJSON / importJSON', () => {
  it('round-trips a presentation losslessly', () => {
    const pres = newPres('Round Trip');
    slideWith(pres, createShape('cloud', { x: 5, y: 5, width: 50, height: 30 }));
    const restored = importJSON(exportJSON(pres));
    expect(restored).toEqual(pres);
  });

  it('importJSON rejects malformed input', () => {
    expect(() => importJSON('not json')).toThrow(/Invalid presentation/);
    expect(() => importJSON('{"formatVersion":2}')).toThrow(/Invalid presentation/);
  });
});

describe('exportOutlineText', () => {
  it('lists slide numbers, titles and body bullets', () => {
    const pres = newPres();
    // Slide 1 is the default title slide: fill its placeholders.
    const title = pres.slides[0].elements.find((e) => e.placeholder?.kind === 'centeredTitle');
    if (title && title.type === 'textbox') {
      title.textBody = textBodyOf('Welcome');
    }
    // Slide 2: title-and-content.
    const layout = findLayoutByKind(pres.layouts, 'titleAndContent')!;
    const second = addSlide(pres, layout.id);
    for (const el of second.elements) {
      if (el.type !== 'textbox') continue;
      if (el.placeholder?.kind === 'title') {
        el.textBody = textBodyOf('Agenda');
      }
      if (el.placeholder?.kind === 'content') {
        el.textBody = textBodyOf('');
        el.textBody.paragraphs = [paragraphOf('First point'), paragraphOf('Second point')];
      }
    }
    const outline = exportOutlineText(pres);
    expect(outline).toBe(
      ['1. Welcome', '2. Agenda', '  - First point', '  - Second point'].join('\n'),
    );
  });

  it('slides without a title still get a numbered line', () => {
    const pres = newPres();
    blankSlide(pres);
    const outline = exportOutlineText(pres);
    expect(outline.split('\n')[1]).toBe('2.');
  });

  it('skips empty body paragraphs', () => {
    const pres = newPres();
    const layout = findLayoutByKind(pres.layouts, 'titleAndContent')!;
    const slide = addSlide(pres, layout.id);
    const content = slide.elements.find((e) => e.placeholder?.kind === 'content');
    if (content && content.type === 'textbox') {
      content.textBody.paragraphs = [paragraphOf(''), paragraphOf('Only real point')];
    }
    const outline = exportOutlineText(pres);
    expect(outline).toContain('  - Only real point');
    expect((outline.match(/ {2}- /g) ?? []).length).toBe(1);
  });
});
