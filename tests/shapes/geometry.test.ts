import { describe, expect, it } from 'vitest';
import {
  createShape,
  elementsInRect,
  getBounds,
  getRotatedCorners,
  hitTest,
  rectsIntersect,
  unionBoundsOf,
} from '../../src/shapes';

describe('getRotatedCorners', () => {
  it('returns the plain corners when unrotated', () => {
    const corners = getRotatedCorners({
      x: 10, y: 20, width: 100, height: 50, rotation: 0, flipH: false, flipV: false,
    });
    expect(corners).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ]);
  });

  it('rotates clockwise about the center (90 degrees moves TL to the TR position)', () => {
    const [tl, tr, br, bl] = getRotatedCorners({
      x: 0, y: 0, width: 100, height: 100, rotation: 90, flipH: false, flipV: false,
    });
    expect(tl).toEqual({ x: 100, y: 0 });
    expect(tr).toEqual({ x: 100, y: 100 });
    expect(br).toEqual({ x: 0, y: 100 });
    expect(bl).toEqual({ x: 0, y: 0 });
  });
});

describe('getBounds', () => {
  it('equals the transform box for unrotated elements', () => {
    const s = createShape('rectangle', { x: 5, y: 6, width: 30, height: 40 });
    expect(getBounds(s)).toEqual({ x: 5, y: 6, width: 30, height: 40 });
  });

  it('expands for a 45-degree rotated square to the diagonal', () => {
    const s = createShape('rectangle', { x: 0, y: 0, width: 100, height: 100, rotation: 45 });
    const b = getBounds(s);
    const halfDiag = (100 * Math.SQRT2) / 2;
    expect(b.x).toBeCloseTo(50 - halfDiag, 3);
    expect(b.y).toBeCloseTo(50 - halfDiag, 3);
    expect(b.width).toBeCloseTo(100 * Math.SQRT2, 3);
    expect(b.height).toBeCloseTo(100 * Math.SQRT2, 3);
  });

  it('swaps width/height for a 90-degree rotated rectangle', () => {
    const s = createShape('rectangle', { x: 0, y: 0, width: 100, height: 20, rotation: 90 });
    const b = getBounds(s);
    expect(b.width).toBeCloseTo(20, 3);
    expect(b.height).toBeCloseTo(100, 3);
    // center preserved at (50, 10)
    expect(b.x + b.width / 2).toBeCloseTo(50, 3);
    expect(b.y + b.height / 2).toBeCloseTo(10, 3);
  });

  it('unionBoundsOf covers all elements', () => {
    const a = createShape('rectangle', { x: 0, y: 0, width: 10, height: 10 });
    const b = createShape('rectangle', { x: 90, y: 40, width: 10, height: 20 });
    expect(unionBoundsOf([a, b])).toEqual({ x: 0, y: 0, width: 100, height: 60 });
    expect(() => unionBoundsOf([])).toThrow();
  });
});

describe('hitTest', () => {
  it('hits inside and misses outside an unrotated box', () => {
    const s = createShape('rectangle', { x: 10, y: 10, width: 100, height: 50 });
    expect(hitTest(s, { x: 60, y: 30 })).toBe(true);
    expect(hitTest(s, { x: 10, y: 10 })).toBe(true); // edge counts
    expect(hitTest(s, { x: 111, y: 30 })).toBe(false);
    expect(hitTest(s, { x: 60, y: 61 })).toBe(false);
  });

  it('respects rotation (inverse-rotates the point)', () => {
    // 100x20 bar rotated 90 deg about center (50, 10): occupies x in [40,60], y in [-40,60]
    const s = createShape('rectangle', {
      x: 0, y: 0, width: 100, height: 20, rotation: 90,
    });
    expect(hitTest(s, { x: 50, y: 55 })).toBe(true); // inside rotated bar
    expect(hitTest(s, { x: 95, y: 10 })).toBe(false); // inside original box, outside rotated
    expect(hitTest(s, { x: 50, y: -35 })).toBe(true); // above original box, inside rotated
  });

  it('hits the corner of a 45-degree rotated square only where covered', () => {
    const s = createShape('rectangle', { x: 0, y: 0, width: 100, height: 100, rotation: 45 });
    expect(hitTest(s, { x: 50, y: 50 })).toBe(true); // center always hits
    expect(hitTest(s, { x: 2, y: 2 })).toBe(false); // original corner uncovered after rotation
    expect(hitTest(s, { x: 50, y: -20 })).toBe(true); // rotated tip above the box
  });

  it('never hits hidden elements', () => {
    const s = createShape('rectangle', { x: 0, y: 0, width: 100, height: 100 });
    s.hidden = true;
    expect(hitTest(s, { x: 50, y: 50 })).toBe(false);
  });
});

describe('elementsInRect (marquee)', () => {
  it('selects intersecting elements only, preserving input order', () => {
    const a = createShape('rectangle', { x: 0, y: 0, width: 20, height: 20 });
    const b = createShape('rectangle', { x: 100, y: 100, width: 20, height: 20 });
    const c = createShape('rectangle', { x: 30, y: 5, width: 10, height: 10 });
    const hit = elementsInRect([a, b, c], { x: 10, y: 0, width: 40, height: 30 });
    expect(hit.map((e) => e.id)).toEqual([a.id, c.id]);
  });

  it('accounts for rotation-expanded bounds and skips hidden elements', () => {
    const rot = createShape('rectangle', { x: 100, y: 100, width: 100, height: 100, rotation: 45 });
    // rotated bounds start near x = 150 - 70.71 = 79.3
    expect(elementsInRect([rot], { x: 0, y: 100, width: 85, height: 100 })).toHaveLength(1);
    rot.hidden = true;
    expect(elementsInRect([rot], { x: 0, y: 100, width: 85, height: 100 })).toHaveLength(0);
  });

  it('rectsIntersect treats edge contact as intersecting and disjoint as not', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
  });
});
