/**
 * Geometry queries: rotated corners, axis-aligned bounds, hit testing,
 * marquee (rect) selection.
 *
 * All angles are clockwise degrees in screen coordinates (y grows down).
 */

import type { Point, Rect, SlideElement, Transform } from '../core/types';
import { degToRad, round } from '../core/util';

/** Round and normalize -0 to +0 to avoid float noise in geometry results. */
function fix(n: number): number {
  const v = round(n);
  return v === 0 ? 0 : v;
}

/** Rotate a point around a center by the given clockwise angle (degrees). */
export function rotatePoint(p: Point, center: Point, deg: number): Point {
  if (deg === 0) return { x: p.x, y: p.y };
  const rad = degToRad(deg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Center point of a transform's box. */
export function getCenter(t: Transform): Point {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
}

/**
 * The four corners of a transform's box after rotation about its center,
 * in order: top-left, top-right, bottom-right, bottom-left (pre-rotation
 * designations). Flips do not change the corner positions.
 */
export function getRotatedCorners(t: Transform): [Point, Point, Point, Point] {
  const c = getCenter(t);
  const corners: [Point, Point, Point, Point] = [
    { x: t.x, y: t.y },
    { x: t.x + t.width, y: t.y },
    { x: t.x + t.width, y: t.y + t.height },
    { x: t.x, y: t.y + t.height },
  ];
  if (t.rotation === 0) return corners;
  return corners.map((p) => {
    const r = rotatePoint(p, c, t.rotation);
    return { x: fix(r.x), y: fix(r.y) };
  }) as [Point, Point, Point, Point];
}

/** Axis-aligned bounding box of a transform, accounting for rotation. */
export function getTransformBounds(t: Transform): Rect {
  if (t.rotation === 0) {
    return { x: t.x, y: t.y, width: t.width, height: t.height };
  }
  const corners = getRotatedCorners(t);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: fix(minX),
    y: fix(minY),
    width: fix(Math.max(...xs) - minX),
    height: fix(Math.max(...ys) - minY),
  };
}

/** Axis-aligned bounding box of an element, accounting for rotation. */
export function getBounds(el: SlideElement): Rect {
  return getTransformBounds(el.transform);
}

/** Union of the bounds of several elements. Throws on an empty list. */
export function unionBoundsOf(elements: SlideElement[]): Rect {
  if (elements.length === 0) throw new Error('unionBoundsOf: empty element list');
  return unionRects(elements.map(getBounds));
}

/** Union of a non-empty list of rects. */
export function unionRects(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** True when two rects overlap (edge contact counts as intersecting). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

/**
 * Hit test a point against an element, respecting rotation: the point is
 * inverse-rotated about the element center and tested against the local box.
 * Hidden elements never hit. Groups are tested against their own box.
 */
export function hitTest(el: SlideElement, point: Point): boolean {
  if (el.hidden) return false;
  const t = el.transform;
  const local = rotatePoint(point, getCenter(t), -t.rotation);
  const eps = 1e-9;
  return (
    local.x >= t.x - eps &&
    local.x <= t.x + t.width + eps &&
    local.y >= t.y - eps &&
    local.y <= t.y + t.height + eps
  );
}

/**
 * Marquee selection: all elements whose (rotation-aware) bounds intersect
 * the given rect. Hidden elements are skipped. Order matches input order.
 */
export function elementsInRect(elements: SlideElement[], rect: Rect): SlideElement[] {
  return elements.filter((el) => !el.hidden && rectsIntersect(getBounds(el), rect));
}
