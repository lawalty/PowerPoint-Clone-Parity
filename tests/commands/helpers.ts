/** Shared builders for command-module tests. */

import type {
  Animation,
  GroupElement,
  Presentation,
  ShapeElement,
  Slide,
  SlideElement,
  TableElement,
} from '../../src/core/types';
import {
  defaultEffects,
  defaultLine,
  defaultTextBody,
  defaultTransform,
  defaultTransition,
  textBodyOf,
} from '../../src/core/defaults';
import { genId } from '../../src/core/util';

export function makeShape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: genId('shape'),
    name: 'Shape',
    type: 'shape',
    geometry: 'rectangle',
    transform: defaultTransform({ x: 10, y: 20 }),
    hidden: false,
    locked: false,
    fill: { type: 'solid', color: { type: 'theme', slot: 'accent1' } },
    line: defaultLine(),
    effects: defaultEffects(),
    textBody: defaultTextBody(),
    ...overrides,
  };
}

export function makeGroup(children: SlideElement[], overrides: Partial<GroupElement> = {}): GroupElement {
  return {
    id: genId('group'),
    name: 'Group',
    type: 'group',
    transform: defaultTransform({ x: 0, y: 0, width: 200, height: 200 }),
    hidden: false,
    locked: false,
    children,
    ...overrides,
  };
}

export function makeTable(rows = 2, cols = 2): TableElement {
  return {
    id: genId('table'),
    name: 'Table',
    type: 'table',
    transform: defaultTransform({ width: 300, height: 100 }),
    hidden: false,
    locked: false,
    rows: Array.from({ length: rows }, () => ({
      height: 30,
      cells: Array.from({ length: cols }, () => ({
        id: genId('cell'),
        textBody: textBodyOf('cell'),
        fill: { type: 'none' } as const,
        borders: {},
        rowSpan: 1,
        colSpan: 1,
        merged: false,
      })),
    })),
    columnWidths: Array.from({ length: cols }, () => 150),
    firstRowHeader: true,
    bandedRows: false,
    bandedColumns: false,
    styleAccent: 'accent1',
  };
}

export function makeAnimation(targetElementId: string, overrides: Partial<Animation> = {}): Animation {
  return {
    id: genId('anim'),
    targetElementId,
    category: 'entrance',
    effect: 'fade',
    trigger: 'onClick',
    delay: 0,
    duration: 500,
    repeat: 1,
    ...overrides,
  };
}

export function makeSlide(elements: SlideElement[] = [], overrides: Partial<Slide> = {}): Slide {
  return {
    id: genId('slide'),
    layoutId: 'layout-1',
    elements,
    transition: defaultTransition(),
    animations: [],
    notes: defaultTextBody(),
    comments: [],
    hidden: false,
    hideBackgroundGraphics: false,
    ...overrides,
  };
}

export function makePresentation(slides: Slide[]): Presentation {
  return {
    id: genId('pres'),
    formatVersion: 1,
    properties: {
      title: 'Test Deck',
      author: 'Tester',
      subject: '',
      createdAt: 0,
      modifiedAt: 0,
      revision: 1,
    },
    slideSize: { width: 960, height: 540 },
    slides,
    sections: [],
    masters: [],
    layouts: [],
    themes: [],
    defaultMasterId: 'master-1',
  };
}

/** Collect every id in an element tree (element ids + table cell ids). */
export function collectIds(element: SlideElement, out: string[] = []): string[] {
  out.push(element.id);
  if (element.type === 'group') {
    for (const child of element.children) collectIds(child, out);
  } else if (element.type === 'table') {
    for (const row of element.rows) for (const cell of row.cells) out.push(cell.id);
  }
  return out;
}
