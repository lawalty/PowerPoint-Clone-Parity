/**
 * Element factories for the shapes & geometry engine.
 *
 * Every factory produces a fully-populated SlideElement with
 * PowerPoint-like defaults:
 *  - shapes get an accent1 solid fill and a darker accent1 outline
 *  - text boxes get no fill and no line
 *  - pictures get no line
 */

import type {
  FreeformElement,
  GroupElement,
  LineElement,
  PictureElement,
  ShapeElement,
  ShapeGeometry,
  SlideElement,
  TextBoxElement,
  Transform,
} from '../core/types';
import {
  defaultEffects,
  defaultLine,
  defaultTextBody,
  defaultTransform,
  noLine,
  textBodyOf,
  themeColor,
} from '../core/defaults';
import { genId } from '../core/util';
import { unionBoundsOf } from './geometry';

let shapeCounter = 0;
function nextName(base: string): string {
  shapeCounter += 1;
  return `${base} ${shapeCounter}`;
}

/** Create a preset-geometry shape with accent1 solid fill. */
export function createShape(
  geometry: ShapeGeometry,
  transform: Partial<Transform> = {},
  overrides: Partial<Omit<ShapeElement, 'type'>> = {},
): ShapeElement {
  return {
    id: genId('shape'),
    name: nextName('Shape'),
    type: 'shape',
    geometry,
    transform: defaultTransform(transform),
    hidden: false,
    locked: false,
    fill: { type: 'solid', color: themeColor('accent1') },
    line: defaultLine(),
    effects: defaultEffects(),
    textBody: defaultTextBody(),
    ...(geometry === 'roundedRectangle' ? { adjustment: 0.16 } : {}),
    ...overrides,
  };
}

/** Create a text box: no fill, no line, containing the given text. */
export function createTextBox(text: string, transform: Partial<Transform> = {}): TextBoxElement {
  return {
    id: genId('textbox'),
    name: nextName('TextBox'),
    type: 'textbox',
    transform: defaultTransform({ width: 200, height: 40, ...transform }),
    hidden: false,
    locked: false,
    fill: { type: 'none' },
    line: noLine(),
    effects: defaultEffects(),
    textBody: textBodyOf(text, { autofit: 'resize', wordWrap: false }),
  };
}

/** Create a picture element with no crop and no outline. */
export function createPicture(src: string, transform: Partial<Transform> = {}): PictureElement {
  return {
    id: genId('picture'),
    name: nextName('Picture'),
    type: 'picture',
    src,
    transform: defaultTransform(transform),
    hidden: false,
    locked: false,
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    line: noLine(),
    effects: defaultEffects(),
    altText: '',
  };
}

/** Create a line / connector element. */
export function createLine(
  connector: LineElement['connector'] = 'straight',
  transform: Partial<Transform> = {},
): LineElement {
  return {
    id: genId('line'),
    name: nextName('Connector'),
    type: 'line',
    connector,
    transform: defaultTransform({ height: 0, ...transform }),
    hidden: false,
    locked: false,
    line: defaultLine({ headArrow: 'none', tailArrow: 'none' }),
  };
}

/** Create a freeform (custom path) element. Path points are normalized 0..1. */
export function createFreeform(
  path: FreeformElement['path'],
  closed: boolean,
  transform: Partial<Transform> = {},
): FreeformElement {
  return {
    id: genId('freeform'),
    name: nextName('Freeform'),
    type: 'freeform',
    path,
    closed,
    transform: defaultTransform(transform),
    hidden: false,
    locked: false,
    fill: closed ? { type: 'solid', color: themeColor('accent1') } : { type: 'none' },
    line: defaultLine(),
    effects: defaultEffects(),
  };
}

/**
 * Create a group element wrapping the given children.
 *
 * If `transform` is omitted, the group's transform is the union of the
 * children's bounds and the children are treated as already positioned in
 * absolute coordinates — they are NOT rebased. Use `groupElements` from the
 * group module for the editor "Group" command, which rebases children to
 * group-relative coordinates.
 */
export function createGroup(
  children: SlideElement[],
  transform?: Partial<Transform>,
): GroupElement {
  const base =
    transform !== undefined
      ? defaultTransform(transform)
      : defaultTransform(children.length ? unionBoundsOf(children) : {});
  return {
    id: genId('group'),
    name: nextName('Group'),
    type: 'group',
    transform: base,
    hidden: false,
    locked: false,
    children,
  };
}
