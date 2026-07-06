/**
 * Color math: hex parsing, tint/shade, theme color resolution, CSS output,
 * WCAG luminance/contrast helpers and color mixing.
 */

import type { Color, ColorScheme } from '../core/types';
import { clamp } from '../core/util';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Rgba extends Rgb {
  a: number;
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Parse a hex color string ('1A2B3C', '#1A2B3C' or shorthand 'ABC') into RGB channels. */
export function parseHex(hex: string): Rgb {
  const match = HEX_RE.exec(hex.trim());
  if (!match) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  let digits = match[1];
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((d) => d + d)
      .join('');
  }
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

/** Convert RGB channels to a 6-digit uppercase hex string without '#'. */
export function toHex(rgb: Rgb): string {
  const channel = (c: number) =>
    Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
  return channel(rgb.r) + channel(rgb.g) + channel(rgb.b);
}

/** Lighten toward white: c + (255 - c) * t for each channel. */
export function applyTint(rgb: Rgb, t: number): Rgb {
  const tint = clamp(t, 0, 1);
  return {
    r: Math.round(rgb.r + (255 - rgb.r) * tint),
    g: Math.round(rgb.g + (255 - rgb.g) * tint),
    b: Math.round(rgb.b + (255 - rgb.b) * tint),
  };
}

/** Darken toward black: c * (1 - s) for each channel. */
export function applyShade(rgb: Rgb, s: number): Rgb {
  const shade = clamp(s, 0, 1);
  return {
    r: Math.round(rgb.r * (1 - shade)),
    g: Math.round(rgb.g * (1 - shade)),
    b: Math.round(rgb.b * (1 - shade)),
  };
}

/**
 * Resolve a model Color to concrete RGBA channels.
 * - rgb colors pass through (with their alpha, default 1)
 * - theme colors look up the scheme slot hex, then apply tint, shade, alpha in that order.
 */
export function resolveColor(color: Color, scheme: ColorScheme): Rgba {
  if (color.type === 'rgb') {
    return { ...parseHex(color.value), a: color.alpha ?? 1 };
  }
  const hex = scheme.colors[color.slot];
  let rgb = parseHex(hex);
  if (color.tint !== undefined) {
    rgb = applyTint(rgb, color.tint);
  }
  if (color.shade !== undefined) {
    rgb = applyShade(rgb, color.shade);
  }
  return { ...rgb, a: color.alpha ?? 1 };
}

/** Format RGBA channels as a CSS color string. */
export function colorToCss(color: Rgba): string {
  const r = Math.round(color.r);
  const g = Math.round(color.g);
  const b = Math.round(color.b);
  if (color.a >= 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  const a = Math.round(clamp(color.a, 0, 1) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** WCAG relative luminance of an RGB color, 0 (black) .. 1 (white). */
export function luminance(rgb: Rgb): number {
  const linear = (c: number) => {
    const v = clamp(c, 0, 255) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [dark, light] = la < lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Pick black or white text for the given background, whichever has the higher
 * WCAG contrast ratio. Returns a CSS hex string.
 */
export function contrastingTextColor(bg: Rgb): '#000000' | '#FFFFFF' {
  return contrastRatio(bg, BLACK) >= contrastRatio(bg, WHITE) ? '#000000' : '#FFFFFF';
}

/** Linear interpolation between two colors: t=0 -> a, t=1 -> b. */
export function mixColors(a: Rgb, b: Rgb, t: number): Rgb {
  const mix = clamp(t, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * mix),
    g: Math.round(a.g + (b.g - a.g) * mix),
    b: Math.round(a.b + (b.b - a.b) * mix),
  };
}

/** Convenience: resolve a model Color directly to a CSS string. */
export function resolveColorToCss(color: Color, scheme: ColorScheme): string {
  return colorToCss(resolveColor(color, scheme));
}
