import { describe, expect, it } from 'vitest';
import {
  createShape,
  flipElement,
  moveElement,
  moveTo,
  normalizeAngle,
  resizeElement,
  rotateElement,
  scaleElement,
  setRotation,
  type ResizeAnchor,
} from '../../src/shapes';

const base = () => createShape('rectangle', { x: 10, y: 20, width: 100, height: 50 });

describe('move', () => {
  it('moveElement translates by a delta and returns the element', () => {
    const s = base();
    const out = moveElement(s, 5, -7);
    expect(out).toBe(s);
    expect(s.transform.x).toBe(15);
    expect(s.transform.y).toBe(13);
  });

  it('moveTo sets absolute position', () => {
    const s = moveTo(base(), 300, 400);
    expect(s.transform.x).toBe(300);
    expect(s.transform.y).toBe(400);
    expect(s.transform.width).toBe(100);
  });
});

describe('resizeElement keeps each of the 9 anchors fixed', () => {
  // base box (10, 20, 100, 50) resized to 200 x 100
  const cases: Array<[ResizeAnchor, number, number]> = [
    ['topLeft', 10, 20],
    ['top', -40, 20],
    ['topRight', -90, 20],
    ['left', 10, -5],
    ['center', -40, -5],
    ['right', -90, -5],
    ['bottomLeft', 10, -30],
    ['bottom', -40, -30],
    ['bottomRight', -90, -30],
  ];

  for (const [anchor, ex, ey] of cases) {
    it(`anchor ${anchor}`, () => {
      const s = resizeElement(base(), 200, 100, anchor);
      expect(s.transform.width).toBe(200);
      expect(s.transform.height).toBe(100);
      expect(s.transform.x).toBe(ex);
      expect(s.transform.y).toBe(ey);
    });
  }

  it('clamps negative sizes to zero', () => {
    const s = resizeElement(base(), -50, -10, 'topLeft');
    expect(s.transform.width).toBe(0);
    expect(s.transform.height).toBe(0);
  });
});

describe('scaleElement', () => {
  it('scales about topLeft by default', () => {
    const s = scaleElement(base(), 2);
    expect(s.transform).toMatchObject({ x: 10, y: 20, width: 200, height: 100 });
  });

  it('scales non-uniformly about the center', () => {
    const s = scaleElement(base(), 2, 0.5, 'center');
    // center is (60, 45); new size 200 x 25
    expect(s.transform.width).toBe(200);
    expect(s.transform.height).toBe(25);
    expect(s.transform.x).toBe(-40);
    expect(s.transform.y).toBe(32.5);
  });
});

describe('rotation', () => {
  it('normalizeAngle maps into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(725)).toBe(5);
    expect(normalizeAngle(-360)).toBe(0);
  });

  it('rotateElement accumulates and normalizes', () => {
    const s = base();
    rotateElement(s, 350);
    expect(s.transform.rotation).toBe(350);
    rotateElement(s, 20);
    expect(s.transform.rotation).toBe(10);
    rotateElement(s, -720);
    expect(s.transform.rotation).toBe(10);
  });

  it('setRotation sets an absolute normalized angle', () => {
    const s = setRotation(base(), -90);
    expect(s.transform.rotation).toBe(270);
    expect(setRotation(s, 405).transform.rotation).toBe(45);
  });
});

describe('flipElement', () => {
  it('toggles flags per axis independently', () => {
    const s = base();
    flipElement(s, 'h');
    expect(s.transform.flipH).toBe(true);
    expect(s.transform.flipV).toBe(false);
    flipElement(s, 'v');
    expect(s.transform.flipV).toBe(true);
    flipElement(s, 'h');
    expect(s.transform.flipH).toBe(false);
    expect(s.transform.flipV).toBe(true);
  });
});
