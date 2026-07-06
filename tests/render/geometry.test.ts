import { describe, expect, it } from 'vitest';
import type { ShapeGeometry } from '../../src/core/types';
import { createShape } from '../../src/shapes';
import { renderSlideSVG, shapeGeometrySvg } from '../../src/render';
import { newPres, slideWith, wellFormedError } from './helpers';

const ALL_GEOMETRIES: ShapeGeometry[] = [
  'rectangle',
  'roundedRectangle',
  'ellipse',
  'triangle',
  'rightTriangle',
  'diamond',
  'pentagon',
  'hexagon',
  'star4',
  'star5',
  'star6',
  'arrowRight',
  'arrowLeft',
  'arrowUp',
  'arrowDown',
  'chevron',
  'heart',
  'cloud',
  'speechBubble',
  'parallelogram',
  'trapezoid',
  'plus',
  'pie',
  'donut',
  'blockArc',
  'frame',
  'lightningBolt',
];

const BOX = { x: 10, y: 20, width: 100, height: 50 };

describe('shape geometries', () => {
  it.each(ALL_GEOMETRIES)('%s produces non-empty geometry markup', (geometry) => {
    const svg = shapeGeometrySvg(geometry, BOX, undefined, ' fill="red"');
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).toMatch(/^<(rect|ellipse|polygon|path) /);
    expect(wellFormedError(svg)).toBeNull();
  });

  it.each(ALL_GEOMETRIES)('%s renders inside a well-formed slide SVG', (geometry) => {
    const pres = newPres();
    const slide = slideWith(
      pres,
      createShape(geometry, { x: 100, y: 100, width: 200, height: 150 }),
    );
    const svg = renderSlideSVG(pres, slide);
    expect(wellFormedError(svg)).toBeNull();
    expect(svg).toMatch(/<(polygon|path|ellipse) |<rect (?![^>]*class="slide-background")/);
  });

  it('roundedRectangle honors the adjustment corner ratio', () => {
    const svg = shapeGeometrySvg('roundedRectangle', BOX, 0.3, '');
    // rx = 0.3 * min(100, 50) = 15
    expect(svg).toContain('rx="15"');
  });

  it('ellipse maps the box to cx/cy/rx/ry', () => {
    const svg = shapeGeometrySvg('ellipse', BOX, undefined, '');
    expect(svg).toContain('cx="60"');
    expect(svg).toContain('cy="45"');
    expect(svg).toContain('rx="50"');
    expect(svg).toContain('ry="25"');
  });

  it('donut and frame punch holes with fill-rule="evenodd"', () => {
    expect(shapeGeometrySvg('donut', BOX, undefined, '')).toContain('fill-rule="evenodd"');
    expect(shapeGeometrySvg('frame', BOX, undefined, '')).toContain('fill-rule="evenodd"');
  });

  it('star5 is a 10-point polygon', () => {
    const svg = shapeGeometrySvg('star5', BOX, undefined, '');
    const coords = /points="([^"]*)"/.exec(svg);
    expect(coords).not.toBeNull();
    expect(coords![1].split(' ')).toHaveLength(10);
  });

  it('rotated shape carries a rotate(...) transform about its center', () => {
    const pres = newPres();
    const slide = slideWith(
      pres,
      createShape('rectangle', { x: 100, y: 100, width: 200, height: 100, rotation: 45 }),
    );
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('transform="rotate(45 200 150)"');
  });

  it('flipped shape carries a scale(-1 ...) transform', () => {
    const pres = newPres();
    const slide = slideWith(
      pres,
      createShape('triangle', { x: 0, y: 0, width: 100, height: 100, flipH: true }),
    );
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('scale(-1 1)');
  });

  it('rotation and flip combine in a single transform attribute', () => {
    const pres = newPres();
    const slide = slideWith(
      pres,
      createShape('rectangle', {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 90,
        flipV: true,
      }),
    );
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toMatch(/transform="rotate\(90 50 50\) translate\(50 50\) scale\(1 -1\)/);
  });
});
