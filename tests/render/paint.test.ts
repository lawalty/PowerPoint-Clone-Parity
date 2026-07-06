import { describe, expect, it } from 'vitest';
import { rgb } from '../../src/core/defaults';
import { createShape } from '../../src/shapes';
import { renderSlideSVG } from '../../src/render';
import { newPres, slideWith, wellFormedError } from './helpers';

describe('fills and strokes', () => {
  it('solid fill resolves theme colors to css', () => {
    const pres = newPres();
    const slide = slideWith(pres, createShape('rectangle', { x: 0, y: 0 }));
    // Default shape fill is accent1 = 4472C4.
    expect(renderSlideSVG(pres, slide)).toContain('fill="rgb(68, 114, 196)"');
  });

  it('gradient fill emits a def and references it', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 0, y: 0 });
    shape.fill = {
      type: 'gradient',
      kind: 'linear',
      angle: 45,
      stops: [
        { position: 0, color: rgb('FF0000') },
        { position: 0.5, color: rgb('00FF00') },
        { position: 1, color: rgb('0000FF') },
      ],
    };
    const slide = slideWith(pres, shape);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('<stop offset="50%" stop-color="rgb(0, 255, 0)"/>');
    const id = /<linearGradient id="([^"]+)"/.exec(svg)![1];
    expect(svg).toContain(`fill="url(#${id})"`);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('radial gradient uses <radialGradient>', () => {
    const pres = newPres();
    const shape = createShape('ellipse', { x: 0, y: 0 });
    shape.fill = {
      type: 'gradient',
      kind: 'radial',
      angle: 0,
      stops: [
        { position: 0, color: rgb('FFFFFF') },
        { position: 1, color: rgb('000000') },
      ],
    };
    const slide = slideWith(pres, shape);
    expect(renderSlideSVG(pres, slide)).toContain('<radialGradient');
  });

  it('pattern fill emits a <pattern> def', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 0, y: 0 });
    shape.fill = {
      type: 'pattern',
      pattern: 'diagonalCross',
      foreground: rgb('000000'),
      background: rgb('FFFFFF'),
    };
    const slide = slideWith(pres, shape);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<pattern');
    expect(svg).toMatch(/fill="url\(#[^"]+\)"/);
  });

  it('picture fill embeds an <image> inside a pattern def', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 0, y: 0 });
    shape.fill = { type: 'picture', src: 'data:image/png;base64,AAAA', mode: 'stretch' };
    const slide = slideWith(pres, shape);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
  });

  it('no-fill shapes render fill="none"', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 0, y: 0 });
    shape.fill = { type: 'none' };
    const slide = slideWith(pres, shape);
    expect(renderSlideSVG(pres, slide)).toContain('fill="none"');
  });

  it('dashed lines carry a stroke-dasharray', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 0, y: 0 });
    shape.line = { ...shape.line, dash: 'dash', width: 2 };
    const slide = slideWith(pres, shape);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('stroke-dasharray="8 6"');
  });

  it('shadow effect emits a gaussian blur filter and applies it', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 100, y: 100, width: 100, height: 100 });
    shape.effects = {
      shadow: { color: rgb('000000', 0.5), blur: 8, distance: 6, angle: 45 },
    };
    const slide = slideWith(pres, shape);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<feGaussianBlur in="SourceAlpha" stdDeviation="4"/>');
    expect(svg).toContain('<feOffset dx="4.24" dy="4.24"');
    expect(svg).toMatch(/filter="url\(#[^"]+\)"/);
    expect(wellFormedError(svg)).toBeNull();
  });
});
