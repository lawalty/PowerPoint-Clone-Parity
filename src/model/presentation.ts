/**
 * Presentation construction.
 */

import type { Presentation } from '../core/types';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../core/defaults';
import { genId } from '../core/util';
import { createOfficeTheme } from './theme';
import { createDefaultMaster } from './master';
import { createBuiltInLayouts, findLayoutByKind } from './layouts';
import { addSlide } from './slides';

export interface CreatePresentationOptions {
  title?: string;
  author?: string;
  subject?: string;
  /** Clock used for createdAt/modifiedAt; injectable for deterministic tests. */
  now?: () => number;
}

/**
 * Build a complete default presentation: the Office theme, one slide master,
 * all nine built-in layouts, and a single starting 'title' slide.
 */
export function createPresentation(options: CreatePresentationOptions = {}): Presentation {
  const now = options.now ?? Date.now;
  const timestamp = now();

  const theme = createOfficeTheme();
  const master = createDefaultMaster(theme.id);
  const layouts = createBuiltInLayouts(master.id);
  master.layoutIds = layouts.map((l) => l.id);

  const pres: Presentation = {
    id: genId('pres'),
    formatVersion: 1,
    properties: {
      title: options.title ?? 'Untitled Presentation',
      author: options.author ?? '',
      subject: options.subject ?? '',
      createdAt: timestamp,
      modifiedAt: timestamp,
      revision: 1,
    },
    slideSize: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    slides: [],
    sections: [],
    masters: [master],
    layouts,
    themes: [theme],
    defaultMasterId: master.id,
  };

  const titleLayout = findLayoutByKind(layouts, 'title') ?? layouts[0];
  addSlide(pres, titleLayout.id);
  return pres;
}
