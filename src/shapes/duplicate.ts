/**
 * Element duplication: deep clone with fresh ids throughout the tree
 * (group children, table cells), offset by (12, 12) like PowerPoint's
 * Ctrl+D paste offset.
 */

import type { SlideElement } from '../core/types';
import { deepClone, genId } from '../core/util';

export const DUPLICATE_OFFSET = 12;

function reassignIds(el: SlideElement): void {
  el.id = genId(el.type);
  if (el.type === 'group') {
    for (const child of el.children) reassignIds(child);
  } else if (el.type === 'table') {
    for (const row of el.rows) {
      for (const cell of row.cells) cell.id = genId('cell');
    }
  }
}

/** Deep-clone an element with all-new ids, offset by (12, 12). */
export function duplicateElement<T extends SlideElement>(el: T): T {
  const copy = deepClone(el);
  reassignIds(copy);
  copy.transform.x += DUPLICATE_OFFSET;
  copy.transform.y += DUPLICATE_OFFSET;
  return copy;
}
