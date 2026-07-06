import { describe, expect, it } from 'vitest';
import {
  createFreeform,
  createGroup,
  createLine,
  createPicture,
  createShape,
  createTextBox,
} from '../../src/shapes';

describe('element factories', () => {
  it('createShape produces a shape with accent1 solid fill and defaults', () => {
    const s = createShape('rectangle');
    expect(s.type).toBe('shape');
    expect(s.geometry).toBe('rectangle');
    expect(s.fill).toEqual({ type: 'solid', color: { type: 'theme', slot: 'accent1' } });
    expect(s.line.width).toBe(1);
    expect(s.transform).toEqual({
      x: 0, y: 0, width: 100, height: 100, rotation: 0, flipH: false, flipV: false,
    });
    expect(s.hidden).toBe(false);
    expect(s.locked).toBe(false);
    expect(s.textBody.paragraphs.length).toBeGreaterThan(0);
    expect(s.id).toBeTruthy();
  });

  it('createShape applies transform partials and overrides', () => {
    const s = createShape('ellipse', { x: 5, y: 6, width: 70 }, { name: 'My Oval', locked: true });
    expect(s.transform.x).toBe(5);
    expect(s.transform.y).toBe(6);
    expect(s.transform.width).toBe(70);
    expect(s.transform.height).toBe(100); // default preserved
    expect(s.name).toBe('My Oval');
    expect(s.locked).toBe(true);
  });

  it('createShape gives roundedRectangle a default adjustment', () => {
    const s = createShape('roundedRectangle');
    expect(s.adjustment).toBeCloseTo(0.16);
    expect(createShape('rectangle').adjustment).toBeUndefined();
  });

  it('factories generate unique ids', () => {
    const ids = [createShape('rectangle'), createShape('rectangle'), createTextBox('x')].map(
      (e) => e.id,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('createTextBox has no fill and no line, and carries the text', () => {
    const t = createTextBox('Hello', { x: 10, y: 20 });
    expect(t.type).toBe('textbox');
    expect(t.fill).toEqual({ type: 'none' });
    expect(t.line.fill).toEqual({ type: 'none' });
    expect(t.line.width).toBe(0);
    const run = t.textBody.paragraphs[0].children[0];
    expect(run).toMatchObject({ type: 'run', text: 'Hello' });
    expect(t.transform.x).toBe(10);
  });

  it('createPicture stores src, zero crop and no outline', () => {
    const p = createPicture('img.png', { width: 300, height: 200 });
    expect(p.type).toBe('picture');
    expect(p.src).toBe('img.png');
    expect(p.crop).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    expect(p.line.fill).toEqual({ type: 'none' });
    expect(p.altText).toBe('');
  });

  it('createLine defaults to straight with no arrowheads and zero height', () => {
    const l = createLine();
    expect(l.type).toBe('line');
    expect(l.connector).toBe('straight');
    expect(l.line.headArrow).toBe('none');
    expect(l.line.tailArrow).toBe('none');
    expect(l.transform.height).toBe(0);
    expect(createLine('elbow').connector).toBe('elbow');
  });

  it('createFreeform: closed paths get a fill, open paths do not', () => {
    const path = [
      { x: 0, y: 0, onCurve: true },
      { x: 1, y: 0, onCurve: true },
      { x: 0.5, y: 1, onCurve: true },
    ];
    const closed = createFreeform(path, true);
    const open = createFreeform(path, false);
    expect(closed.closed).toBe(true);
    expect(closed.fill.type).toBe('solid');
    expect(open.fill).toEqual({ type: 'none' });
    expect(closed.path).toHaveLength(3);
  });

  it('createGroup without a transform sizes itself to the children union bounds', () => {
    const a = createShape('rectangle', { x: 10, y: 10, width: 20, height: 20 });
    const b = createShape('rectangle', { x: 50, y: 40, width: 30, height: 10 });
    const g = createGroup([a, b]);
    expect(g.type).toBe('group');
    expect(g.children).toHaveLength(2);
    expect(g.transform).toMatchObject({ x: 10, y: 10, width: 70, height: 40 });
  });
});
