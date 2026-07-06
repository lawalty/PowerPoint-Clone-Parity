/**
 * Transform operations: move, resize, scale, rotate, flip.
 *
 * All operations mutate the element's transform in place and return the same
 * element for chaining. Resize/scale anchors are expressed in the element's
 * own (unrotated) axis-aligned box; rotation is not re-applied to the anchor,
 * which matches PowerPoint's behavior of resizing in the local frame.
 */

import type { SlideElement } from '../core/types';

/** The nine resize anchors: the named point stays fixed during resize. */
export type ResizeAnchor =
  | 'topLeft'
  | 'top'
  | 'topRight'
  | 'left'
  | 'center'
  | 'right'
  | 'bottomLeft'
  | 'bottom'
  | 'bottomRight';

/** Fraction of width/height for each anchor (0 = left/top, 1 = right/bottom). */
const ANCHOR_FRACTIONS: Record<ResizeAnchor, { fx: number; fy: number }> = {
  topLeft: { fx: 0, fy: 0 },
  top: { fx: 0.5, fy: 0 },
  topRight: { fx: 1, fy: 0 },
  left: { fx: 0, fy: 0.5 },
  center: { fx: 0.5, fy: 0.5 },
  right: { fx: 1, fy: 0.5 },
  bottomLeft: { fx: 0, fy: 1 },
  bottom: { fx: 0.5, fy: 1 },
  bottomRight: { fx: 1, fy: 1 },
};

/** Normalize an angle in degrees to the range [0, 360). */
export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Translate an element by (dx, dy). */
export function moveElement<T extends SlideElement>(el: T, dx: number, dy: number): T {
  el.transform.x += dx;
  el.transform.y += dy;
  return el;
}

/** Move an element so its transform origin (top-left) is at (x, y). */
export function moveTo<T extends SlideElement>(el: T, x: number, y: number): T {
  el.transform.x = x;
  el.transform.y = y;
  return el;
}

/**
 * Resize an element to (newW, newH), keeping the given anchor point of the
 * element's local box fixed. Negative sizes are clamped to 0.
 */
export function resizeElement<T extends SlideElement>(
  el: T,
  newW: number,
  newH: number,
  anchor: ResizeAnchor = 'topLeft',
): T {
  const t = el.transform;
  const { fx, fy } = ANCHOR_FRACTIONS[anchor];
  const anchorX = t.x + fx * t.width;
  const anchorY = t.y + fy * t.height;
  t.width = Math.max(0, newW);
  t.height = Math.max(0, newH);
  t.x = anchorX - fx * t.width;
  t.y = anchorY - fy * t.height;
  return el;
}

/** Scale an element's size by (sx, sy) about the given anchor. */
export function scaleElement<T extends SlideElement>(
  el: T,
  sx: number,
  sy: number = sx,
  anchor: ResizeAnchor = 'topLeft',
): T {
  return resizeElement(el, el.transform.width * sx, el.transform.height * sy, anchor);
}

/** Rotate by a delta in degrees (clockwise). Result normalized to [0, 360). */
export function rotateElement<T extends SlideElement>(el: T, deltaDeg: number): T {
  el.transform.rotation = normalizeAngle(el.transform.rotation + deltaDeg);
  return el;
}

/** Set an absolute rotation in degrees, normalized to [0, 360). */
export function setRotation<T extends SlideElement>(el: T, deg: number): T {
  el.transform.rotation = normalizeAngle(deg);
  return el;
}

/** Toggle the horizontal or vertical flip flag. */
export function flipElement<T extends SlideElement>(el: T, axis: 'h' | 'v'): T {
  if (axis === 'h') el.transform.flipH = !el.transform.flipH;
  else el.transform.flipV = !el.transform.flipV;
  return el;
}
