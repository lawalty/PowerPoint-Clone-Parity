import { describe, expect, it } from 'vitest';
import {
  alignElements,
  bringForward,
  bringToFront,
  createShape,
  distributeElements,
  sendBackward,
  sendToBack,
} from '../../src/shapes';
import type { SlideElement } from '../../src/core/types';

const rect = (x: number, y: number, w: number, h: number) =>
  createShape('rectangle', { x, y, width: w, height: h });

describe('alignElements relative to selection', () => {
  it('left aligns to the union left edge', () => {
    const a = rect(10, 10, 50, 50);
    const b = rect(100, 40, 20, 20);
    alignElements([a, b], 'left');
    expect(a.transform.x).toBe(10);
    expect(b.transform.x).toBe(10);
  });

  it('centerH aligns horizontal centers to the union center', () => {
    const a = rect(10, 10, 50, 50); // union x: 10..120, center 65
    const b = rect(100, 40, 20, 20);
    alignElements([a, b], 'centerH');
    expect(a.transform.x).toBe(40); // center 65
    expect(b.transform.x).toBe(55);
    expect(a.transform.y).toBe(10); // vertical untouched
  });

  it('right, top, centerV and bottom produce exact coordinates', () => {
    const mk = () => [rect(10, 10, 50, 50), rect(100, 40, 20, 20)] as const;

    let [a, b] = mk();
    alignElements([a, b], 'right'); // union right = 120
    expect(a.transform.x).toBe(70);
    expect(b.transform.x).toBe(100);

    [a, b] = mk();
    alignElements([a, b], 'top'); // union top = 10
    expect(a.transform.y).toBe(10);
    expect(b.transform.y).toBe(10);

    [a, b] = mk();
    alignElements([a, b], 'centerV'); // union y: 10..60, center 35
    expect(a.transform.y).toBe(10);
    expect(b.transform.y).toBe(25);

    [a, b] = mk();
    alignElements([a, b], 'bottom'); // union bottom = 60
    expect(a.transform.y).toBe(10);
    expect(b.transform.y).toBe(40);
  });

  it('uses rotation-aware bounds when aligning', () => {
    const spun = createShape('rectangle', { x: 100, y: 0, width: 100, height: 100, rotation: 45 });
    const flat = rect(0, 0, 10, 10);
    alignElements([spun, flat], 'left');
    // spun bounds left was 150 - 70.71.. = 79.289; flat at 0 stays; spun shifts left
    const halfDiag = (100 * Math.SQRT2) / 2;
    expect(flat.transform.x).toBe(0);
    expect(spun.transform.x).toBeCloseTo(100 - (150 - halfDiag), 3);
  });
});

describe('alignElements relative to slide', () => {
  const slide = { slide: { width: 960, height: 540 } };

  it('centers a single element on the slide', () => {
    const a = rect(0, 0, 100, 50);
    alignElements([a], 'centerH', slide);
    alignElements([a], 'centerV', slide);
    expect(a.transform.x).toBe(430);
    expect(a.transform.y).toBe(245);
  });

  it('aligns to slide edges', () => {
    const a = rect(200, 200, 100, 50);
    alignElements([a], 'right', slide);
    expect(a.transform.x).toBe(860);
    alignElements([a], 'bottom', slide);
    expect(a.transform.y).toBe(490);
    alignElements([a], 'left', slide);
    expect(a.transform.x).toBe(0);
    alignElements([a], 'top', slide);
    expect(a.transform.y).toBe(0);
  });
});

describe('distributeElements', () => {
  it('creates equal horizontal gaps, keeping the outer elements fixed', () => {
    const a = rect(0, 0, 10, 10);
    const b = rect(50, 20, 10, 10);
    const c = rect(200, 40, 10, 10);
    distributeElements([a, b, c], 'horizontal');
    // span 0..210, widths 30, gap (210-30)/2 = 90 → b at x=100
    expect(a.transform.x).toBe(0);
    expect(b.transform.x).toBe(100);
    expect(c.transform.x).toBe(200);
    expect(b.transform.y).toBe(20); // vertical untouched
  });

  it('distributes vertically with mixed sizes', () => {
    const a = rect(0, 0, 10, 20);
    const b = rect(0, 30, 10, 40);
    const c = rect(0, 200, 10, 10);
    distributeElements([a, b, c], 'vertical');
    // span 0..210, heights 70, gap (210-70)/2 = 70 → b at y = 20+70 = 90
    expect(a.transform.y).toBe(0);
    expect(b.transform.y).toBe(90);
    expect(c.transform.y).toBe(200);
  });

  it('is order-insensitive: sorts by position, not array order', () => {
    const a = rect(200, 0, 10, 10);
    const b = rect(0, 0, 10, 10);
    const c = rect(50, 0, 10, 10);
    distributeElements([a, b, c], 'horizontal');
    expect(b.transform.x).toBe(0);
    expect(c.transform.x).toBe(100);
    expect(a.transform.x).toBe(200);
  });

  it('is a no-op for fewer than 3 elements', () => {
    const a = rect(0, 0, 10, 10);
    const b = rect(37, 0, 10, 10);
    distributeElements([a, b], 'horizontal');
    expect(a.transform.x).toBe(0);
    expect(b.transform.x).toBe(37);
  });
});

describe('z-order', () => {
  function stack(): { els: SlideElement[]; ids: string[] } {
    const els = [rect(0, 0, 1, 1), rect(0, 0, 1, 1), rect(0, 0, 1, 1)];
    return { els, ids: els.map((e) => e.id) };
  }

  it('bringToFront moves an element to the end of the array', () => {
    const { els, ids } = stack();
    bringToFront(els, ids[0]);
    expect(els.map((e) => e.id)).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('sendToBack moves an element to index 0', () => {
    const { els, ids } = stack();
    sendToBack(els, ids[2]);
    expect(els.map((e) => e.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it('bringForward / sendBackward swap one step', () => {
    const { els, ids } = stack();
    bringForward(els, ids[0]);
    expect(els.map((e) => e.id)).toEqual([ids[1], ids[0], ids[2]]);
    sendBackward(els, ids[0]);
    expect(els.map((e) => e.id)).toEqual([ids[0], ids[1], ids[2]]);
  });

  it('edge cases: already at front/back and unknown ids are no-ops', () => {
    const { els, ids } = stack();
    bringToFront(els, ids[2]);
    bringForward(els, ids[2]);
    sendToBack(els, ids[0]);
    sendBackward(els, ids[0]);
    bringToFront(els, 'ghost');
    sendBackward(els, 'ghost');
    expect(els.map((e) => e.id)).toEqual(ids);
  });
});
