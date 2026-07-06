/**
 * Placeholder element construction shared by the master and layout builders.
 */

import type {
  PlaceholderKind,
  TextAlign,
  TextBoxElement,
  VerticalAlign,
} from '../core/types';
import { defaultEffects, defaultParagraph, defaultTextBody, defaultTransform, noLine } from '../core/defaults';
import { genId } from '../core/util';

export interface PlaceholderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlaceholderTextOptions {
  align?: TextAlign;
  verticalAlign?: VerticalAlign;
}

/**
 * Build an empty text-box placeholder element of the given kind.
 * The `index` links slide placeholders back to their layout counterparts.
 */
export function placeholderElement(
  kind: PlaceholderKind,
  index: number,
  name: string,
  rect: PlaceholderRect,
  text: PlaceholderTextOptions = {},
): TextBoxElement {
  return {
    id: genId('ph'),
    type: 'textbox',
    name,
    transform: defaultTransform({ ...rect }),
    hidden: false,
    locked: false,
    placeholder: { kind, index },
    fill: { type: 'none' },
    line: noLine(),
    effects: defaultEffects(),
    textBody: defaultTextBody({
      paragraphs: [defaultParagraph({ align: text.align ?? 'left' })],
      verticalAlign: text.verticalAlign ?? 'top',
    }),
  };
}
