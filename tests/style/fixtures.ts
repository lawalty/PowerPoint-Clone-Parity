/** Shared test fixtures for the style module tests. */

import type {
  ColorScheme,
  LineElement,
  PictureElement,
  Presentation,
  ShapeElement,
  Slide,
  SlideLayout,
  SlideMaster,
  TextBoxElement,
  Theme,
} from '../../src/core/types';
import {
  defaultEffects,
  defaultLine,
  defaultTextBody,
  defaultTransform,
  defaultTransition,
  textBodyOf,
} from '../../src/core/defaults';

export const testScheme: ColorScheme = {
  name: 'Test',
  colors: {
    dark1: '000000',
    light1: 'FFFFFF',
    dark2: '444444',
    light2: 'EEEEEE',
    accent1: 'FF0000',
    accent2: '00FF00',
    accent3: '0000FF',
    accent4: 'FFFF00',
    accent5: '00FFFF',
    accent6: 'FF00FF',
    hyperlink: '0563C1',
    followedHyperlink: '954F72',
  },
};

export const testTheme: Theme = {
  id: 'th1',
  name: 'Test Theme',
  colorScheme: testScheme,
  fontScheme: { name: 'Test Fonts', major: 'Heading Font', minor: 'Body Font' },
};

export function shape(id: string, overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id,
    name: id,
    type: 'shape',
    geometry: 'rectangle',
    transform: defaultTransform(),
    hidden: false,
    locked: false,
    fill: { type: 'solid', color: { type: 'theme', slot: 'accent1' } },
    line: defaultLine(),
    effects: defaultEffects(),
    textBody: textBodyOf(`text of ${id}`),
    ...overrides,
  };
}

export function textbox(id: string, overrides: Partial<TextBoxElement> = {}): TextBoxElement {
  return {
    id,
    name: id,
    type: 'textbox',
    transform: defaultTransform(),
    hidden: false,
    locked: false,
    fill: { type: 'none' },
    line: defaultLine({ fill: { type: 'none' }, width: 0 }),
    effects: defaultEffects(),
    textBody: textBodyOf(`text of ${id}`),
    ...overrides,
  };
}

export function picture(id: string, overrides: Partial<PictureElement> = {}): PictureElement {
  return {
    id,
    name: id,
    type: 'picture',
    transform: defaultTransform(),
    hidden: false,
    locked: false,
    src: 'image.png',
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    line: defaultLine(),
    effects: defaultEffects(),
    altText: id,
    ...overrides,
  };
}

export function lineElement(id: string, overrides: Partial<LineElement> = {}): LineElement {
  return {
    id,
    name: id,
    type: 'line',
    transform: defaultTransform(),
    hidden: false,
    locked: false,
    connector: 'straight',
    line: defaultLine(),
    ...overrides,
  };
}

export function makeSlide(id: string, overrides: Partial<Slide> = {}): Slide {
  return {
    id,
    layoutId: 'l1',
    elements: [],
    transition: defaultTransition(),
    animations: [],
    notes: defaultTextBody(),
    comments: [],
    hidden: false,
    hideBackgroundGraphics: false,
    ...overrides,
  };
}

export interface FixtureOptions {
  slide?: Partial<Slide>;
  layout?: Partial<SlideLayout>;
  master?: Partial<SlideMaster>;
}

/**
 * A presentation with one theme (th1), one master (m1) with a decoration and
 * title/body placeholders, one layout (l1) with a decoration and a title
 * placeholder, and one slide (s1).
 */
export function makePresentation(options: FixtureOptions = {}): Presentation {
  const master: SlideMaster = {
    id: 'm1',
    name: 'Master',
    themeId: 'th1',
    background: { type: 'solid', color: { type: 'theme', slot: 'dark2' } },
    elements: [
      shape('m-deco'),
      shape('m-title', {
        placeholder: { kind: 'title', index: 0 },
        transform: defaultTransform({ x: 10, y: 10, width: 800, height: 100 }),
        textBody: textBodyOf('Master title', {
          paragraphs: [
            {
              children: [
                {
                  type: 'run',
                  text: 'Master title',
                  font: {
                    family: 'major',
                    size: 44,
                    bold: false,
                    italic: false,
                    underline: false,
                    strikethrough: false,
                    color: { type: 'theme', slot: 'dark1' },
                    baseline: 'baseline',
                    letterSpacing: 0,
                    capitalization: 'none',
                  },
                },
              ],
              align: 'left',
              level: 0,
              bullet: { type: 'none' },
              lineSpacing: 1,
              spaceBefore: 0,
              spaceAfter: 0,
              indent: 0,
            },
          ],
        }),
      }),
      shape('m-body', {
        placeholder: { kind: 'body', index: 1 },
        transform: defaultTransform({ x: 10, y: 130, width: 800, height: 350 }),
      }),
    ],
    layoutIds: ['l1'],
    ...options.master,
  };

  const layout: SlideLayout = {
    id: 'l1',
    name: 'Title Layout',
    kind: 'title',
    masterId: 'm1',
    elements: [
      shape('l-deco'),
      shape('l-title', {
        placeholder: { kind: 'title', index: 0 },
        transform: defaultTransform({ x: 20, y: 20, width: 700, height: 90 }),
        textBody: textBodyOf('Layout title', {
          paragraphs: [
            {
              children: [
                {
                  type: 'run',
                  text: 'Layout title',
                  font: {
                    family: 'major',
                    size: 40,
                    bold: true,
                    italic: false,
                    underline: false,
                    strikethrough: false,
                    color: { type: 'theme', slot: 'accent1' },
                    baseline: 'baseline',
                    letterSpacing: 0,
                    capitalization: 'none',
                  },
                },
              ],
              align: 'center',
              level: 0,
              bullet: { type: 'none' },
              lineSpacing: 1,
              spaceBefore: 0,
              spaceAfter: 0,
              indent: 0,
            },
          ],
        }),
      }),
    ],
    ...options.layout,
  };

  const slide = makeSlide('s1', options.slide);

  return {
    id: 'pres1',
    formatVersion: 1,
    properties: {
      title: 'Fixture',
      author: 'tests',
      subject: '',
      createdAt: 0,
      modifiedAt: 0,
      revision: 1,
    },
    slideSize: { width: 960, height: 540 },
    slides: [slide],
    sections: [],
    masters: [master],
    layouts: [layout],
    themes: [structuredClone(testTheme)],
    defaultMasterId: 'm1',
  };
}
