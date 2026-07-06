/**
 * Factory functions producing default-valued model objects.
 * All modules should build model instances through these to stay consistent.
 */

import type {
  Bullet,
  Effects,
  FontRef,
  LineStyle,
  Paragraph,
  TextBody,
  TextRun,
  ThemeColorSlot,
  Transform,
  Transition,
  Color,
} from './types';

export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;

export function themeColor(slot: ThemeColorSlot): Color {
  return { type: 'theme', slot };
}

export function rgb(value: string, alpha?: number): Color {
  return alpha === undefined ? { type: 'rgb', value } : { type: 'rgb', value, alpha };
}

export function defaultFont(overrides: Partial<FontRef> = {}): FontRef {
  return {
    family: 'minor',
    size: 18,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    color: { type: 'theme', slot: 'dark1' },
    baseline: 'baseline',
    letterSpacing: 0,
    capitalization: 'none',
    ...overrides,
  };
}

export function textRun(text: string, font: Partial<FontRef> = {}): TextRun {
  return { type: 'run', text, font: defaultFont(font) };
}

export function noBullet(): Bullet {
  return { type: 'none' };
}

export function defaultParagraph(overrides: Partial<Paragraph> = {}): Paragraph {
  return {
    children: [],
    align: 'left',
    level: 0,
    bullet: noBullet(),
    lineSpacing: 1,
    spaceBefore: 0,
    spaceAfter: 0,
    indent: 0,
    ...overrides,
  };
}

export function paragraphOf(text: string, overrides: Partial<Paragraph> = {}): Paragraph {
  return defaultParagraph({ children: text.length ? [textRun(text)] : [], ...overrides });
}

export function defaultTextBody(overrides: Partial<TextBody> = {}): TextBody {
  return {
    paragraphs: [defaultParagraph()],
    verticalAlign: 'top',
    autofit: 'none',
    wordWrap: true,
    insets: { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 },
    columns: 1,
    ...overrides,
  };
}

export function textBodyOf(text: string, overrides: Partial<TextBody> = {}): TextBody {
  return defaultTextBody({ paragraphs: [paragraphOf(text)], ...overrides });
}

export function defaultLine(overrides: Partial<LineStyle> = {}): LineStyle {
  return {
    fill: { type: 'solid', color: { type: 'theme', slot: 'accent1', shade: 0.25 } },
    width: 1,
    dash: 'solid',
    cap: 'flat',
    ...overrides,
  };
}

export function noLine(): LineStyle {
  return defaultLine({ fill: { type: 'none' }, width: 0 });
}

export function defaultEffects(): Effects {
  return {};
}

export function defaultTransform(overrides: Partial<Transform> = {}): Transform {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipH: false,
    flipV: false,
    ...overrides,
  };
}

export function defaultTransition(overrides: Partial<Transition> = {}): Transition {
  return {
    kind: 'none',
    duration: 500,
    advanceOnClick: true,
    ...overrides,
  };
}
