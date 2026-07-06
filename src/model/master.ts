/**
 * Default slide master construction.
 */

import type { Id, SlideMaster } from '../core/types';
import { genId } from '../core/util';
import { placeholderElement } from './placeholders';

/**
 * Build the default slide master for a 960x540 slide: a light background
 * plus title / body / date / footer / slide-number placeholders.
 * `layoutIds` starts empty and is filled in once the layouts are created.
 */
export function createDefaultMaster(themeId: Id): SlideMaster {
  return {
    id: genId('master'),
    name: 'Office Master',
    themeId,
    background: { type: 'solid', color: { type: 'theme', slot: 'light1' } },
    elements: [
      placeholderElement('title', 0, 'Title Placeholder', { x: 60, y: 25, width: 840, height: 80 }, { verticalAlign: 'middle' }),
      placeholderElement('body', 1, 'Body Placeholder', { x: 60, y: 120, width: 840, height: 335 }),
      placeholderElement('date', 10, 'Date Placeholder', { x: 60, y: 505, width: 220, height: 25 }),
      placeholderElement('footer', 11, 'Footer Placeholder', { x: 330, y: 505, width: 300, height: 25 }, { align: 'center' }),
      placeholderElement('slideNumber', 12, 'Slide Number Placeholder', { x: 680, y: 505, width: 220, height: 25 }, { align: 'right' }),
    ],
    layoutIds: [],
  };
}
