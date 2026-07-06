// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { rgb, textBodyOf } from '../../src/core/defaults';
import { createChart } from '../../src/charts';
import {
  createFreeform,
  createGroup,
  createLine,
  createPicture,
  createShape,
  createTextBox,
} from '../../src/shapes';
import { createTable, setCellText } from '../../src/tables';
import { renderSlideSVG } from '../../src/render';
import { exportPresentationHTML } from '../../src/export';
import { newPres, slideWith } from './helpers';

function kitchenSinkSlide() {
  const pres = newPres('Kitchen & Sink');
  const shape = createShape('star5', { x: 20, y: 20, width: 100, height: 100, rotation: 30 });
  shape.effects = { shadow: { color: rgb('000000', 0.4), blur: 6, distance: 4, angle: 90 } };
  shape.textBody = textBodyOf('Star <1> & Co');
  const pic = createPicture('data:image/png;base64,QQ==', { x: 150, y: 20, width: 120, height: 80 });
  pic.crop = { left: 0.1, top: 0.1, right: 0.1, bottom: 0.1 };
  pic.altText = 'alt & <text>';
  const line = createLine('elbow', { x: 300, y: 20, width: 100, height: 80 });
  line.line.tailArrow = 'triangle';
  const ff = createFreeform(
    [
      { x: 0, y: 0, onCurve: true },
      { x: 0.5, y: 1, onCurve: false },
      { x: 1, y: 0, onCurve: true },
    ],
    true,
    { x: 450, y: 20, width: 80, height: 80 },
  );
  const group = createGroup(
    [createShape('heart', { x: 0, y: 0, width: 40, height: 40 })],
    { x: 560, y: 20, width: 40, height: 40, rotation: 10 },
  );
  const table = createTable(2, 2, { x: 20, y: 200, width: 200, height: 64 });
  setCellText(table, 0, 0, 'H & M');
  const chart = createChart('pie', { x: 300, y: 200, width: 300, height: 250 });
  const box = createTextBox('plain text', { x: 650, y: 200 });
  const slide = slideWith(pres, shape, pic, line, ff, group, table, chart, box);
  return { pres, slide };
}

describe('DOMParser well-formedness', () => {
  it('a kitchen-sink slide parses as valid SVG', () => {
    const { pres, slide } = kitchenSinkSlide();
    const svg = renderSlideSVG(pres, slide);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 960 540');
  });

  it('exported HTML parses and embeds one svg per visible slide', () => {
    const { pres } = kitchenSinkSlide();
    pres.slides[0].hidden = true; // hide the default title slide
    const html = exportPresentationHTML(pres);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.title).toBe('Kitchen & Sink');
    const sections = doc.querySelectorAll('section.slide');
    expect(sections.length).toBe(1);
    expect(doc.querySelectorAll('section.slide svg').length).toBe(1);
    expect(doc.getElementById('prev-slide')).not.toBeNull();
    expect(doc.getElementById('next-slide')).not.toBeNull();
  });
});
