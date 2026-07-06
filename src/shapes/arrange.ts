/**
 * Arrange operations: align, distribute, and z-order.
 */

import type { Id, Rect, Size, SlideElement } from '../core/types';
import { getBounds, unionBoundsOf } from './geometry';
import { moveElement } from './transform';

export type Alignment = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';
export type AlignTarget = 'selection' | { slide: Size };

/**
 * Align elements' (rotation-aware) bounds to the target rect.
 * - 'selection' (default): the union bounds of the elements themselves.
 * - { slide }: the slide rect (0, 0, width, height).
 * Elements are moved by delta; sizes and rotations are untouched.
 */
export function alignElements(
  elements: SlideElement[],
  alignment: Alignment,
  relativeTo: AlignTarget = 'selection',
): SlideElement[] {
  if (elements.length === 0) return elements;
  const target: Rect =
    relativeTo === 'selection'
      ? unionBoundsOf(elements)
      : { x: 0, y: 0, width: relativeTo.slide.width, height: relativeTo.slide.height };

  for (const el of elements) {
    const b = getBounds(el);
    switch (alignment) {
      case 'left':
        moveElement(el, target.x - b.x, 0);
        break;
      case 'centerH':
        moveElement(el, target.x + target.width / 2 - (b.x + b.width / 2), 0);
        break;
      case 'right':
        moveElement(el, target.x + target.width - (b.x + b.width), 0);
        break;
      case 'top':
        moveElement(el, 0, target.y - b.y);
        break;
      case 'centerV':
        moveElement(el, 0, target.y + target.height / 2 - (b.y + b.height / 2));
        break;
      case 'bottom':
        moveElement(el, 0, target.y + target.height - (b.y + b.height));
        break;
    }
  }
  return elements;
}

/**
 * Distribute elements so the gaps between adjacent bounds are equal.
 * The outermost elements (by current position) stay fixed; the others are
 * repositioned between them. Relative order along the axis is preserved.
 * Requires 3+ elements to have any effect.
 */
export function distributeElements(
  elements: SlideElement[],
  axis: 'horizontal' | 'vertical',
): SlideElement[] {
  if (elements.length < 3) return elements;
  const horizontal = axis === 'horizontal';
  const entries = elements
    .map((el) => ({ el, b: getBounds(el) }))
    .sort((a, z) => (horizontal ? a.b.x - z.b.x : a.b.y - z.b.y));

  const first = entries[0];
  const last = entries[entries.length - 1];
  const span = horizontal
    ? last.b.x + last.b.width - first.b.x
    : last.b.y + last.b.height - first.b.y;
  const totalSize = entries.reduce(
    (sum, e) => sum + (horizontal ? e.b.width : e.b.height),
    0,
  );
  const gap = (span - totalSize) / (entries.length - 1);

  let cursor = horizontal ? first.b.x + first.b.width : first.b.y + first.b.height;
  for (let i = 1; i < entries.length - 1; i++) {
    const e = entries[i];
    cursor += gap;
    if (horizontal) moveElement(e.el, cursor - e.b.x, 0);
    else moveElement(e.el, 0, cursor - e.b.y);
    cursor += horizontal ? e.b.width : e.b.height;
  }
  return elements;
}

// ---------------------------------------------------------------------------
// Z-order — operate on a slide's elements array (index 0 = back).
// ---------------------------------------------------------------------------

function indexOfId(elements: SlideElement[], id: Id): number {
  return elements.findIndex((el) => el.id === id);
}

/** Move the element with the given id to the end (front). */
export function bringToFront(elements: SlideElement[], id: Id): SlideElement[] {
  const i = indexOfId(elements, id);
  if (i === -1 || i === elements.length - 1) return elements;
  const [el] = elements.splice(i, 1);
  elements.push(el);
  return elements;
}

/** Move the element with the given id to index 0 (back). */
export function sendToBack(elements: SlideElement[], id: Id): SlideElement[] {
  const i = indexOfId(elements, id);
  if (i <= 0) return elements;
  const [el] = elements.splice(i, 1);
  elements.unshift(el);
  return elements;
}

/** Swap the element one step toward the front. No-op if already at front. */
export function bringForward(elements: SlideElement[], id: Id): SlideElement[] {
  const i = indexOfId(elements, id);
  if (i === -1 || i === elements.length - 1) return elements;
  [elements[i], elements[i + 1]] = [elements[i + 1], elements[i]];
  return elements;
}

/** Swap the element one step toward the back. No-op if already at back. */
export function sendBackward(elements: SlideElement[], id: Id): SlideElement[] {
  const i = indexOfId(elements, id);
  if (i <= 0) return elements;
  [elements[i], elements[i - 1]] = [elements[i - 1], elements[i]];
  return elements;
}
