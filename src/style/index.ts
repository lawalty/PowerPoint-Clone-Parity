/**
 * Styling, color resolution, and theme system.
 */

export {
  applyShade,
  applyTint,
  colorToCss,
  contrastRatio,
  contrastingTextColor,
  luminance,
  mixColors,
  parseHex,
  resolveColor,
  resolveColorToCss,
  toHex,
} from './color';
export type { Rgb, Rgba } from './color';

export { dashArrayFor, gradientToCss, resolveFill, resolveLine } from './fill';
export type {
  ResolvedFill,
  ResolvedGradientFill,
  ResolvedGradientStop,
  ResolvedLine,
  ResolvedNoFill,
  ResolvedPatternFill,
  ResolvedPictureFill,
  ResolvedSolidFill,
} from './fill';

export { resolveFont, resolveFontFamily } from './font';
export type { ResolvedFont } from './font';

export { applyTheme, builtInTheme, builtInThemes } from './themes';

export {
  effectiveElements,
  getLayout,
  getMaster,
  getTheme,
  resolvePlaceholderDefaults,
  resolveSlideBackground,
} from './inherit';
export type { PlaceholderDefaults } from './inherit';

export { copyStyle, pasteStyle } from './painter';
export type { ParagraphStyleSnapshot, StyleSnapshot } from './painter';
