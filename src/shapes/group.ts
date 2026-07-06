/**
 * Grouping, ungrouping and tree traversal.
 *
 * Group coordinate model: a GroupElement's transform is the union bounds of
 * its children at group time; children's transforms are stored relative to
 * the group origin (group.transform.x/y). A group's own rotation/flips apply
 * VISUALLY at render time to the whole group — group/ungroup here only
 * handle translation, so ungrouping a rotated group restores the children's
 * un-rotated absolute positions (the same model PowerPoint uses internally
 * for child offsets).
 */

import type { GroupElement, Id, SlideElement } from '../core/types';
import { createGroup } from './factories';
import { unionBoundsOf } from './geometry';

/**
 * Group elements: returns a GroupElement whose transform is the union of the
 * children's bounds. The children's transforms are rebased in place to be
 * relative to the group origin. Nested groups are supported (a child group's
 * own children stay relative to it and need no adjustment).
 */
export function groupElements(elements: SlideElement[]): GroupElement {
  if (elements.length === 0) throw new Error('groupElements: cannot group zero elements');
  const bounds = unionBoundsOf(elements);
  for (const el of elements) {
    el.transform.x -= bounds.x;
    el.transform.y -= bounds.y;
  }
  return createGroup(elements, {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
}

/**
 * Ungroup: restore the children to absolute coordinates by adding the group
 * origin back, and return them. The group's rotation/flips are visual-only
 * (see module doc) and are intentionally not baked into the children.
 */
export function ungroup(group: GroupElement): SlideElement[] {
  const { x, y } = group.transform;
  for (const child of group.children) {
    child.transform.x += x;
    child.transform.y += y;
  }
  return group.children;
}

/** Depth-first walker over an element tree, descending into groups. */
export function visitElements(
  elements: SlideElement[],
  visit: (el: SlideElement, parent: GroupElement | null) => void,
  parent: GroupElement | null = null,
): void {
  for (const el of elements) {
    visit(el, parent);
    if (el.type === 'group') visitElements(el.children, visit, el);
  }
}

/** Find an element by id, recursing into groups. */
export function findElementById(elements: SlideElement[], id: Id): SlideElement | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.type === 'group') {
      const found = findElementById(el.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Remove an element by id from the tree (recursing into groups), mutating
 * the containing array. Returns the removed element, or undefined.
 */
export function removeElementById(elements: SlideElement[], id: Id): SlideElement | undefined {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.id === id) {
      elements.splice(i, 1);
      return el;
    }
    if (el.type === 'group') {
      const removed = removeElementById(el.children, id);
      if (removed) return removed;
    }
  }
  return undefined;
}
