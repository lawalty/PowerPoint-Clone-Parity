import { describe, expect, it } from 'vitest';
import { rgb } from '../../src/core/defaults';
import {
  createFreeform,
  createGroup,
  createLine,
  createPicture,
  createShape,
} from '../../src/shapes';
import { createTable, mergeCells, setCellText } from '../../src/tables';
import { renderSlideSVG } from '../../src/render';
import { newPres, slideWith, wellFormedError } from './helpers';

describe('picture rendering', () => {
  it('renders an <image> with href, size and alt text <title>', () => {
    const pres = newPres();
    const pic = createPicture('data:image/png;base64,QUJD', {
      x: 50,
      y: 60,
      width: 200,
      height: 100,
    });
    pic.altText = 'A chart of Q1 <results> & more';
    const slide = slideWith(pres, pic);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('href="data:image/png;base64,QUJD"');
    expect(svg).toContain('<image x="50" y="60" width="200" height="100"');
    expect(svg).toContain('<title>A chart of Q1 &lt;results&gt; &amp; more</title>');
    expect(wellFormedError(svg)).toBeNull();
  });

  it('applies crop via a clipPath and an enlarged image', () => {
    const pres = newPres();
    const pic = createPicture('img.png', { x: 100, y: 100, width: 200, height: 100 });
    pic.crop = { left: 0.25, top: 0, right: 0.25, bottom: 0 };
    const slide = slideWith(pres, pic);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<clipPath');
    expect(svg).toMatch(/clip-path="url\(#[^"]+\)"/);
    // Visible width fraction 0.5 -> full image drawn at 400 wide, shifted left 100.
    expect(svg).toContain('<image x="0" y="100" width="400" height="100"');
  });

  it('uncropped pictures need no clipPath', () => {
    const pres = newPres();
    const slide = slideWith(pres, createPicture('img.png', { x: 0, y: 0 }));
    expect(renderSlideSVG(pres, slide)).not.toContain('<clipPath');
  });
});

describe('line / connector rendering', () => {
  it('straight lines render as <line> with endpoints from the transform', () => {
    const pres = newPres();
    const line = createLine('straight', { x: 10, y: 20, width: 100, height: 50 });
    const slide = slideWith(pres, line);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<line x1="10" y1="20" x2="110" y2="70"');
  });

  it('arrowheads become marker defs referenced by the line', () => {
    const pres = newPres();
    const line = createLine('straight', { x: 0, y: 0, width: 100, height: 0 });
    line.line.headArrow = 'triangle';
    line.line.tailArrow = 'oval';
    const slide = slideWith(pres, line);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('<marker');
    expect(svg).toMatch(/marker-start="url\(#[^"]+\)"/);
    expect(svg).toMatch(/marker-end="url\(#[^"]+\)"/);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('elbow connectors render an L-segment path', () => {
    const pres = newPres();
    const line = createLine('elbow', { x: 0, y: 0, width: 100, height: 60 });
    const slide = slideWith(pres, line);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('d="M 0 0 L 50 0 L 50 60 L 100 60"');
  });

  it('curved connectors render a cubic bezier path', () => {
    const pres = newPres();
    const line = createLine('curved', { x: 0, y: 0, width: 100, height: 60 });
    const slide = slideWith(pres, line);
    expect(renderSlideSVG(pres, slide)).toContain('d="M 0 0 C 50 0 50 60 100 60"');
  });

  it('attached connector endpoints snap to the target connection site', () => {
    const pres = newPres();
    const target = createShape('rectangle', { x: 100, y: 100, width: 100, height: 100 });
    const line = createLine('straight', { x: 0, y: 0, width: 50, height: 50 });
    line.endAttachment = { elementId: target.id, site: 1 }; // East
    const slide = slideWith(pres, target, line);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('x2="200" y2="150"');
  });
});

describe('freeform rendering', () => {
  it('renders a closed path from normalized points scaled by the transform', () => {
    const pres = newPres();
    const ff = createFreeform(
      [
        { x: 0, y: 0, onCurve: true },
        { x: 1, y: 0, onCurve: true },
        { x: 1, y: 1, onCurve: true },
      ],
      true,
      { x: 10, y: 10, width: 100, height: 100 },
    );
    const slide = slideWith(pres, ff);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('d="M 10 10 L 110 10 L 110 110 Z"');
    expect(svg).toContain('fill="rgb(68, 114, 196)"');
  });

  it('open freeforms are unfilled and off-curve points become Q curves', () => {
    const pres = newPres();
    const ff = createFreeform(
      [
        { x: 0, y: 0, onCurve: true },
        { x: 0.5, y: 1, onCurve: false },
        { x: 1, y: 0, onCurve: true },
      ],
      false,
      { x: 0, y: 0, width: 100, height: 100 },
    );
    const slide = slideWith(pres, ff);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('d="M 0 0 Q 50 100 100 0"');
    expect(svg).toMatch(/<path[^>]*fill="none"/);
  });
});

describe('group rendering', () => {
  it('renders a nested <g> with the group translation and its children', () => {
    const pres = newPres();
    const child = createShape('rectangle', { x: 5, y: 6, width: 10, height: 10 });
    const group = createGroup([child], { x: 100, y: 50, width: 20, height: 20 });
    const slide = slideWith(pres, group);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toMatch(/<g class="group" transform="translate\(100 50\)">/);
    expect(svg).toContain('x="5" y="6"');
    expect(wellFormedError(svg)).toBeNull();
  });

  it('group rotation composes with the translation', () => {
    const pres = newPres();
    const child = createShape('rectangle', { x: 0, y: 0, width: 20, height: 20 });
    const group = createGroup([child], { x: 100, y: 50, width: 20, height: 20, rotation: 30 });
    const slide = slideWith(pres, group);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('transform="rotate(30 110 60) translate(100 50)"');
  });

  it('renders nested groups recursively', () => {
    const pres = newPres();
    const leaf = createShape('ellipse', { x: 1, y: 1, width: 4, height: 4 });
    const inner = createGroup([leaf], { x: 10, y: 10, width: 5, height: 5 });
    const outer = createGroup([inner], { x: 100, y: 100, width: 20, height: 20 });
    const slide = slideWith(pres, outer);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('translate(100 100)');
    expect(svg).toContain('translate(10 10)');
    expect(svg).toContain('<ellipse');
  });

  it('hidden children inside groups are skipped', () => {
    const pres = newPres();
    const shown = createShape('rectangle', { x: 0, y: 0, width: 5, height: 5 });
    const hidden = createShape('ellipse', { x: 0, y: 0, width: 5, height: 5 });
    hidden.hidden = true;
    const group = createGroup([shown, hidden], { x: 0, y: 0, width: 10, height: 10 });
    const slide = slideWith(pres, group);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).not.toContain('<ellipse');
  });
});

describe('table rendering', () => {
  it('renders one rect per visible cell', () => {
    const pres = newPres();
    const table = createTable(2, 3, { x: 100, y: 100, width: 300, height: 64 });
    const slide = slideWith(pres, table);
    const svg = renderSlideSVG(pres, slide);
    expect((svg.match(/class="cell"/g) ?? []).length).toBe(6);
  });

  it('merged regions collapse to a single anchored rect', () => {
    const pres = newPres();
    const table = createTable(2, 3, { x: 100, y: 100, width: 300, height: 64 });
    mergeCells(table, 0, 0, 0, 1);
    const slide = slideWith(pres, table);
    const svg = renderSlideSVG(pres, slide);
    expect((svg.match(/class="cell"/g) ?? []).length).toBe(5);
    // Anchor spans two 100pt columns.
    expect(svg).toMatch(/<rect x="100" y="100" width="200" height="32"[^>]*class="cell"/);
  });

  it('paints the header row with the accent color', () => {
    const pres = newPres();
    const table = createTable(2, 2, { x: 0, y: 0, width: 200, height: 64 });
    const slide = slideWith(pres, table);
    const svg = renderSlideSVG(pres, slide);
    // accent1 = 4472C4.
    expect(svg).toMatch(/<rect [^>]*fill="rgb\(68, 114, 196\)" class="cell"/);
  });

  it('renders cell text and explicit borders', () => {
    const pres = newPres();
    const table = createTable(2, 2, { x: 0, y: 0, width: 200, height: 64 });
    setCellText(table, 1, 1, 'Total');
    table.rows[1].cells[1].borders.top = {
      fill: { type: 'solid', color: rgb('FF0000') },
      width: 2,
      dash: 'solid',
      cap: 'flat',
    };
    const slide = slideWith(pres, table);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('>Total</tspan>');
    expect(svg).toMatch(/<line [^>]*stroke="rgb\(255, 0, 0\)" stroke-width="2"/);
    expect(wellFormedError(svg)).toBeNull();
  });
});
