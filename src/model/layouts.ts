/**
 * The nine built-in slide layouts, positioned for a 960x540 slide.
 */

import type { Id, LayoutKind, SlideElement, SlideLayout } from '../core/types';
import { genId } from '../core/util';
import { placeholderElement } from './placeholders';

/** All built-in layout kinds, in PowerPoint's gallery order. */
export const BUILT_IN_LAYOUT_KINDS: readonly LayoutKind[] = [
  'title',
  'titleAndContent',
  'sectionHeader',
  'twoContent',
  'comparison',
  'titleOnly',
  'blank',
  'contentWithCaption',
  'pictureWithCaption',
] as const;

export const LAYOUT_NAMES: Record<LayoutKind, string> = {
  title: 'Title Slide',
  titleAndContent: 'Title and Content',
  sectionHeader: 'Section Header',
  twoContent: 'Two Content',
  comparison: 'Comparison',
  titleOnly: 'Title Only',
  blank: 'Blank',
  contentWithCaption: 'Content with Caption',
  pictureWithCaption: 'Picture with Caption',
};

/** Standard title bar shared by most layouts. */
const TITLE_RECT = { x: 60, y: 25, width: 840, height: 80 };
/** Full-width content area below the title. */
const CONTENT_RECT = { x: 60, y: 120, width: 840, height: 335 };

function buildLayoutElements(kind: LayoutKind): SlideElement[] {
  switch (kind) {
    case 'title':
      return [
        placeholderElement('centeredTitle', 0, 'Title', { x: 80, y: 160, width: 800, height: 120 }, { align: 'center', verticalAlign: 'middle' }),
        placeholderElement('subtitle', 1, 'Subtitle', { x: 160, y: 300, width: 640, height: 90 }, { align: 'center' }),
      ];
    case 'titleAndContent':
      return [
        placeholderElement('title', 0, 'Title', TITLE_RECT, { verticalAlign: 'middle' }),
        placeholderElement('content', 1, 'Content Placeholder', CONTENT_RECT),
      ];
    case 'sectionHeader':
      return [
        placeholderElement('title', 0, 'Title', { x: 60, y: 240, width: 840, height: 100 }, { verticalAlign: 'bottom' }),
        placeholderElement('body', 1, 'Text Placeholder', { x: 60, y: 350, width: 840, height: 70 }),
      ];
    case 'twoContent':
      return [
        placeholderElement('title', 0, 'Title', TITLE_RECT, { verticalAlign: 'middle' }),
        placeholderElement('content', 1, 'Content Placeholder Left', { x: 60, y: 120, width: 410, height: 335 }),
        placeholderElement('content', 2, 'Content Placeholder Right', { x: 490, y: 120, width: 410, height: 335 }),
      ];
    case 'comparison':
      return [
        placeholderElement('title', 0, 'Title', TITLE_RECT, { verticalAlign: 'middle' }),
        placeholderElement('body', 1, 'Heading Left', { x: 60, y: 120, width: 410, height: 50 }),
        placeholderElement('content', 2, 'Content Placeholder Left', { x: 60, y: 180, width: 410, height: 275 }),
        placeholderElement('body', 3, 'Heading Right', { x: 490, y: 120, width: 410, height: 50 }),
        placeholderElement('content', 4, 'Content Placeholder Right', { x: 490, y: 180, width: 410, height: 275 }),
      ];
    case 'titleOnly':
      return [placeholderElement('title', 0, 'Title', TITLE_RECT, { verticalAlign: 'middle' })];
    case 'blank':
      return [];
    case 'contentWithCaption':
      return [
        placeholderElement('title', 0, 'Title', { x: 60, y: 25, width: 300, height: 90 }),
        placeholderElement('body', 1, 'Text Placeholder', { x: 60, y: 125, width: 300, height: 330 }),
        placeholderElement('content', 2, 'Content Placeholder', { x: 390, y: 25, width: 510, height: 430 }),
      ];
    case 'pictureWithCaption':
      return [
        placeholderElement('title', 0, 'Title', { x: 60, y: 25, width: 300, height: 90 }),
        placeholderElement('body', 1, 'Text Placeholder', { x: 60, y: 125, width: 300, height: 330 }),
        placeholderElement('picture', 2, 'Picture Placeholder', { x: 390, y: 25, width: 510, height: 430 }),
      ];
  }
}

/** Build a single layout of the given kind bound to a master. */
export function createLayout(kind: LayoutKind, masterId: Id): SlideLayout {
  return {
    id: genId('layout'),
    name: LAYOUT_NAMES[kind],
    kind,
    masterId,
    elements: buildLayoutElements(kind),
  };
}

/** Build all nine built-in layouts for a master. */
export function createBuiltInLayouts(masterId: Id): SlideLayout[] {
  return BUILT_IN_LAYOUT_KINDS.map((kind) => createLayout(kind, masterId));
}

/** Find a layout by kind (first match), or undefined. */
export function findLayoutByKind(layouts: SlideLayout[], kind: LayoutKind): SlideLayout | undefined {
  return layouts.find((l) => l.kind === kind);
}
