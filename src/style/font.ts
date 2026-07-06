/**
 * Font resolution: maps theme font references ('major'/'minor') to concrete
 * family names and resolves FontRef colors against the theme.
 */

import type { FontRef, FontScheme, Theme } from '../core/types';
import { resolveColorToCss } from './color';

/**
 * Resolve a font family name. 'major' and 'minor' map to the scheme's
 * heading/body fonts; any other name passes through unchanged.
 */
export function resolveFontFamily(family: string, fonts: FontScheme): string {
  if (family === 'major') {
    return fonts.major;
  }
  if (family === 'minor') {
    return fonts.minor;
  }
  return family;
}

export interface ResolvedFont {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  baseline: 'baseline' | 'superscript' | 'subscript';
  letterSpacing: number;
  capitalization: 'none' | 'allCaps' | 'smallCaps';
  /** CSS color string. */
  color: string;
  /** CSS color string, present only when the run has a highlight. */
  highlight?: string;
}

/** Resolve a FontRef to concrete values against a theme. */
export function resolveFont(font: FontRef, theme: Theme): ResolvedFont {
  const resolved: ResolvedFont = {
    family: resolveFontFamily(font.family, theme.fontScheme),
    size: font.size,
    bold: font.bold,
    italic: font.italic,
    underline: font.underline,
    strikethrough: font.strikethrough,
    baseline: font.baseline,
    letterSpacing: font.letterSpacing,
    capitalization: font.capitalization,
    color: resolveColorToCss(font.color, theme.colorScheme),
  };
  if (font.highlight) {
    resolved.highlight = resolveColorToCss(font.highlight, theme.colorScheme);
  }
  return resolved;
}
