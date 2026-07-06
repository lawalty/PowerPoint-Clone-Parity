import { describe, expect, it } from 'vitest';
import { rgb, textBodyOf } from '../../src/core/defaults';
import { setNotesText } from '../../src/model';
import { createShape, createTextBox } from '../../src/shapes';
import { renderNotesText, renderSlideSVG, renderThumbnailSVG } from '../../src/render';
import { blankSlide, newPres, slideWith, wellFormedError } from './helpers';

describe('renderSlideSVG', () => {
  it('produces a standalone svg with xmlns and the slide-size viewBox', () => {
    const pres = newPres();
    const svg = renderSlideSVG(pres, pres.slides[0]);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 960 540"');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('renders the slide background color from the slide override', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    slide.background = { type: 'solid', color: rgb('FF0000') };
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('class="slide-background"');
    expect(svg).toContain('fill="rgb(255, 0, 0)"');
  });

  it('falls back to the layout background, then the master background', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    // Master default: light1 = white.
    expect(renderSlideSVG(pres, slide)).toContain('fill="rgb(255, 255, 255)"');
    // Layout override wins over the master.
    const layout = pres.layouts.find((l) => l.id === slide.layoutId)!;
    layout.background = { type: 'solid', color: rgb('00FF00') };
    expect(renderSlideSVG(pres, slide)).toContain('fill="rgb(0, 255, 0)"');
    // Slide override wins over both.
    slide.background = { type: 'solid', color: rgb('0000FF') };
    expect(renderSlideSVG(pres, slide)).toContain('fill="rgb(0, 0, 255)"');
  });

  it('renders a gradient background via <defs>', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    slide.background = {
      type: 'gradient',
      kind: 'linear',
      angle: 90,
      stops: [
        { position: 0, color: rgb('FF0000') },
        { position: 1, color: rgb('0000FF') },
      ],
    };
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<defs>');
    expect(svg).toContain('<linearGradient');
    expect(svg).toMatch(/fill="url\(#[^"]+\)" class="slide-background"/);
    expect(svg).toContain('gradientTransform="rotate(90 0.5 0.5)"');
  });

  it('draws master decoration elements underneath slide elements', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    const deco = createShape('rectangle', { x: 1, y: 2, width: 3, height: 4 });
    deco.name = 'MasterDeco';
    pres.masters[0].elements.push(deco);
    slide.elements.push(createShape('ellipse', { x: 10, y: 10, width: 20, height: 20 }));
    const svg = renderSlideSVG(pres, slide);
    const decoIdx = svg.indexOf('x="1" y="2" width="3" height="4"');
    const ownIdx = svg.indexOf('<ellipse');
    expect(decoIdx).toBeGreaterThan(-1);
    expect(ownIdx).toBeGreaterThan(decoIdx);
  });

  it('hides master/layout decorations when hideBackgroundGraphics is set', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    pres.masters[0].elements.push(createShape('rectangle', { x: 1, y: 2, width: 3, height: 4 }));
    slide.hideBackgroundGraphics = true;
    const svg = renderSlideSVG(pres, slide);
    expect(svg).not.toContain('x="1" y="2" width="3" height="4"');
  });

  it('skips hidden elements', () => {
    const pres = newPres();
    const hiddenShape = createShape('ellipse', { x: 5, y: 5, width: 50, height: 50 });
    hiddenShape.hidden = true;
    const slide = slideWith(pres, hiddenShape);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).not.toContain('<ellipse');
  });

  it('escapes &, < and > in rendered text', () => {
    const pres = newPres();
    const slide = slideWith(pres, createTextBox('Tom & <Jerry> "quotes"', { x: 10, y: 10 }));
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('Tom &amp; &lt;Jerry&gt;');
    expect(svg).not.toMatch(/<Jerry/);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('respects explicit width/height options while keeping the viewBox', () => {
    const pres = newPres();
    const svg = renderSlideSVG(pres, pres.slides[0], { width: 480, height: 270 });
    expect(svg).toContain('width="480"');
    expect(svg).toContain('height="270"');
    expect(svg).toContain('viewBox="0 0 960 540"');
  });
});

describe('renderThumbnailSVG', () => {
  it('scales the output to maxWidth with proportional height', () => {
    const pres = newPres();
    const svg = renderThumbnailSVG(pres, pres.slides[0], 240);
    expect(svg).toContain('width="240"');
    expect(svg).toContain('height="135"'); // 240 * 540 / 960
    expect(svg).toContain('viewBox="0 0 960 540"');
    expect(wellFormedError(svg)).toBeNull();
  });

  it('never upscales past the native slide width', () => {
    const pres = newPres();
    const svg = renderThumbnailSVG(pres, pres.slides[0], 5000);
    expect(svg).toContain('width="960"');
    expect(svg).toContain('height="540"');
  });
});

describe('renderNotesText', () => {
  it('returns the notes body as plain text', () => {
    const pres = newPres();
    setNotesText(pres, pres.slides[0].id, 'Remember the demo');
    expect(renderNotesText(pres.slides[0])).toBe('Remember the demo');
  });

  it('returns empty text for untouched notes', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    expect(renderNotesText(slide)).toBe('');
  });

  it('joins multiple note paragraphs with newlines', () => {
    const pres = newPres();
    const slide = blankSlide(pres);
    slide.notes = textBodyOf('line one');
    slide.notes.paragraphs.push(textBodyOf('line two').paragraphs[0]);
    expect(renderNotesText(slide)).toBe('line one\nline two');
  });
});
