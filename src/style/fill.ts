/**
 * Fill and line resolution: converts model Fill/LineStyle values (which may
 * reference theme colors) into concrete, renderer-ready values with CSS
 * color strings.
 */

import type { ColorScheme, DashStyle, Fill, LineStyle, PatternKind } from '../core/types';
import { round } from '../core/util';
import { resolveColorToCss } from './color';

export interface ResolvedSolidFill {
  type: 'solid';
  css: string;
}

export interface ResolvedGradientStop {
  /** 0..1 position along the gradient. */
  position: number;
  css: string;
}

export interface ResolvedGradientFill {
  type: 'gradient';
  kind: 'linear' | 'radial';
  /** Model angle in degrees (0 = left-to-right). */
  angle: number;
  stops: ResolvedGradientStop[];
}

export interface ResolvedPictureFill {
  type: 'picture';
  src: string;
  mode: 'stretch' | 'tile';
}

export interface ResolvedPatternFill {
  type: 'pattern';
  pattern: PatternKind;
  foregroundCss: string;
  backgroundCss: string;
}

export interface ResolvedNoFill {
  type: 'none';
}

export type ResolvedFill =
  | ResolvedSolidFill
  | ResolvedGradientFill
  | ResolvedPictureFill
  | ResolvedPatternFill
  | ResolvedNoFill;

/** Resolve a model Fill against a color scheme into concrete values. */
export function resolveFill(fill: Fill, scheme: ColorScheme): ResolvedFill {
  switch (fill.type) {
    case 'solid':
      return { type: 'solid', css: resolveColorToCss(fill.color, scheme) };
    case 'gradient':
      return {
        type: 'gradient',
        kind: fill.kind,
        angle: fill.angle,
        stops: fill.stops
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((stop) => ({
            position: stop.position,
            css: resolveColorToCss(stop.color, scheme),
          })),
      };
    case 'picture':
      return { type: 'picture', src: fill.src, mode: fill.mode };
    case 'pattern':
      return {
        type: 'pattern',
        pattern: fill.pattern,
        foregroundCss: resolveColorToCss(fill.foreground, scheme),
        backgroundCss: resolveColorToCss(fill.background, scheme),
      };
    case 'none':
      return { type: 'none' };
  }
}

/**
 * Produce a CSS gradient string from a resolved gradient fill.
 * The model's 0deg means left-to-right; CSS linear-gradient 0deg points up,
 * so the CSS angle is model angle + 90.
 */
export function gradientToCss(gradient: ResolvedGradientFill): string {
  const stops = gradient.stops
    .map((stop) => `${stop.css} ${round(stop.position * 100, 2)}%`)
    .join(', ');
  if (gradient.kind === 'radial') {
    return `radial-gradient(circle, ${stops})`;
  }
  return `linear-gradient(${gradient.angle + 90}deg, ${stops})`;
}

/** Base dash patterns (in multiples of line width). */
const DASH_PATTERNS: Record<DashStyle, number[] | undefined> = {
  solid: undefined,
  dash: [4, 3],
  dot: [1, 3],
  dashDot: [4, 3, 1, 3],
  longDash: [8, 3],
};

/** Map a dash style to a concrete dash array scaled by line width. */
export function dashArrayFor(dash: DashStyle, width: number): number[] | undefined {
  const pattern = DASH_PATTERNS[dash];
  if (!pattern) {
    return undefined;
  }
  const scale = Math.max(width, 1);
  return pattern.map((v) => round(v * scale, 4));
}

export interface ResolvedLine {
  /** CSS stroke color; 'transparent' when the line has no fill. */
  css: string;
  /** Stroke width in points. */
  width: number;
  dashArray: number[] | undefined;
}

/** Resolve a LineStyle to a concrete stroke description. */
export function resolveLine(line: LineStyle, scheme: ColorScheme): ResolvedLine {
  let css: string;
  switch (line.fill.type) {
    case 'solid':
      css = resolveColorToCss(line.fill.color, scheme);
      break;
    case 'gradient':
      css =
        line.fill.stops.length > 0
          ? resolveColorToCss(line.fill.stops[0].color, scheme)
          : 'transparent';
      break;
    case 'pattern':
      css = resolveColorToCss(line.fill.foreground, scheme);
      break;
    case 'picture':
    case 'none':
      css = 'transparent';
      break;
  }
  return {
    css,
    width: line.width,
    dashArray: dashArrayFor(line.dash, line.width),
  };
}
