/**
 * Fill and stroke attribute generation. Solid fills become plain attribute
 * values; gradient/pattern/picture fills emit <defs> entries with unique ids
 * and reference them via url(#id).
 */

import type { ArrowheadKind, Effects, Fill, LineStyle, Transform } from '../core/types';
import { degToRad } from '../core/util';
import {
  resolveColorToCss,
  resolveFill,
  resolveLine,
  type ResolvedGradientFill,
  type ResolvedPatternFill,
  type ResolvedPictureFill,
} from '../style';
import type { RenderContext } from './context';
import { escapeXml, fmt } from './xml';

function gradientDef(id: string, gradient: ResolvedGradientFill): string {
  const stops = gradient.stops
    .map((s) => `<stop offset="${fmt(s.position * 100)}%" stop-color="${escapeXml(s.css)}"/>`)
    .join('');
  if (gradient.kind === 'radial') {
    return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>`;
  }
  // Model angle 0 = left-to-right, which is SVG's default gradient vector.
  const transform =
    gradient.angle !== 0 ? ` gradientTransform="rotate(${fmt(gradient.angle)} 0.5 0.5)"` : '';
  return `<linearGradient id="${id}"${transform}>${stops}</linearGradient>`;
}

function patternDef(id: string, pattern: ResolvedPatternFill): string {
  const fg = escapeXml(pattern.foregroundCss);
  const bg = escapeXml(pattern.backgroundCss);
  let content: string;
  switch (pattern.pattern) {
    case 'percent50':
      content = `<rect width="4" height="4" fill="${fg}"/><rect x="4" y="4" width="4" height="4" fill="${fg}"/>`;
      break;
    case 'horizontal':
      content = `<rect y="3" width="8" height="2" fill="${fg}"/>`;
      break;
    case 'vertical':
      content = `<rect x="3" width="2" height="8" fill="${fg}"/>`;
      break;
    case 'diagonalDown':
      content = `<path d="M0 0 L8 8" stroke="${fg}" stroke-width="1.5"/>`;
      break;
    case 'diagonalUp':
      content = `<path d="M0 8 L8 0" stroke="${fg}" stroke-width="1.5"/>`;
      break;
    case 'cross':
      content = `<rect y="3" width="8" height="2" fill="${fg}"/><rect x="3" width="2" height="8" fill="${fg}"/>`;
      break;
    case 'diagonalCross':
      content = `<path d="M0 0 L8 8 M0 8 L8 0" stroke="${fg}" stroke-width="1.5"/>`;
      break;
  }
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="8" height="8">` +
    `<rect width="8" height="8" fill="${bg}"/>${content}</pattern>`
  );
}

function pictureFillDef(id: string, picture: ResolvedPictureFill): string {
  const href = escapeXml(picture.src);
  if (picture.mode === 'tile') {
    return (
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="80" height="80">` +
      `<image href="${href}" width="80" height="80"/></pattern>`
    );
  }
  return (
    `<pattern id="${id}" patternContentUnits="objectBoundingBox" width="1" height="1">` +
    `<image href="${href}" width="1" height="1" preserveAspectRatio="none"/></pattern>`
  );
}

/**
 * The value for a fill="..." attribute. Gradient / pattern / picture fills
 * push a def into the context and return a url(#id) reference.
 */
export function fillAttrValue(fill: Fill, ctx: RenderContext): string {
  const resolved = resolveFill(fill, ctx.scheme);
  switch (resolved.type) {
    case 'none':
      return 'none';
    case 'solid':
      return resolved.css;
    case 'gradient': {
      const id = ctx.nextId('grad');
      ctx.defs.push(gradientDef(id, resolved));
      return `url(#${id})`;
    }
    case 'pattern': {
      const id = ctx.nextId('pat');
      ctx.defs.push(patternDef(id, resolved));
      return `url(#${id})`;
    }
    case 'picture': {
      const id = ctx.nextId('img');
      ctx.defs.push(pictureFillDef(id, resolved));
      return `url(#${id})`;
    }
  }
}

/** stroke/stroke-width/stroke-dasharray/linecap attributes for a LineStyle. */
export function strokeAttrs(line: LineStyle, ctx: RenderContext): string {
  const resolved = resolveLine(line, ctx.scheme);
  if (resolved.width <= 0 || resolved.css === 'transparent') {
    return ' stroke="none"';
  }
  let out = ` stroke="${escapeXml(resolved.css)}" stroke-width="${fmt(resolved.width)}"`;
  if (resolved.dashArray) {
    out += ` stroke-dasharray="${resolved.dashArray.map(fmt).join(' ')}"`;
  }
  if (line.cap === 'round') {
    out += ' stroke-linecap="round"';
  } else if (line.cap === 'square') {
    out += ' stroke-linecap="square"';
  }
  return out;
}

/**
 * A ` filter="url(#id)"` attribute for the element's shadow (a gaussian-blur
 * based drop shadow filter pushed into the defs), or '' when no shadow.
 */
export function shadowFilterAttr(effects: Effects, ctx: RenderContext): string {
  const shadow = effects.shadow;
  if (!shadow) {
    return '';
  }
  const id = ctx.nextId('shadow');
  const rad = degToRad(shadow.angle);
  const dx = shadow.distance * Math.cos(rad);
  const dy = shadow.distance * Math.sin(rad);
  const color = resolveColorToCss(shadow.color, ctx.scheme);
  ctx.defs.push(
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${fmt(Math.max(shadow.blur / 2, 0))}"/>` +
      `<feOffset dx="${fmt(dx)}" dy="${fmt(dy)}" result="ppshadow"/>` +
      `<feFlood flood-color="${escapeXml(color)}"/>` +
      `<feComposite in2="ppshadow" operator="in"/>` +
      `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>` +
      `</filter>`,
  );
  return ` filter="url(#${id})"`;
}

/** Marker content per arrowhead kind, drawn in an 8x8 box pointing +x. */
function markerContent(kind: Exclude<ArrowheadKind, 'none'>, color: string): string {
  switch (kind) {
    case 'arrow':
      return `<path d="M0 0 L8 4 L0 8" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    case 'triangle':
      return `<path d="M0 0 L8 4 L0 8 Z" fill="${color}"/>`;
    case 'stealth':
      return `<path d="M0 0 L8 4 L0 8 L3 4 Z" fill="${color}"/>`;
    case 'diamond':
      return `<path d="M4 0 L8 4 L4 8 L0 4 Z" fill="${color}"/>`;
    case 'oval':
      return `<circle cx="4" cy="4" r="3.5" fill="${color}"/>`;
  }
}

/**
 * Push an arrowhead <marker> def and return its id, or undefined for 'none'.
 * The marker points along +x and uses auto-start-reverse so the same def
 * works for both marker-start and marker-end.
 */
export function arrowMarkerId(
  kind: ArrowheadKind | undefined,
  color: string,
  ctx: RenderContext,
): string | undefined {
  if (!kind || kind === 'none') {
    return undefined;
  }
  const id = ctx.nextId('marker');
  ctx.defs.push(
    `<marker id="${id}" markerWidth="10" markerHeight="10" refX="7" refY="4"` +
      ` orient="auto-start-reverse" markerUnits="strokeWidth">` +
      `${markerContent(kind, escapeXml(color))}</marker>`,
  );
  return id;
}

/**
 * transform="..." value applying an element's rotation and flips about its
 * center, or undefined when the transform is identity.
 */
export function rotateFlipTransform(t: Transform): string | undefined {
  const parts: string[] = [];
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;
  if (t.rotation !== 0) {
    parts.push(`rotate(${fmt(t.rotation)} ${fmt(cx)} ${fmt(cy)})`);
  }
  if (t.flipH || t.flipV) {
    const sx = t.flipH ? -1 : 1;
    const sy = t.flipV ? -1 : 1;
    parts.push(
      `translate(${fmt(cx)} ${fmt(cy)}) scale(${sx} ${sy}) translate(${fmt(-cx)} ${fmt(-cy)})`,
    );
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/** Wrap content in a <g> applying rotation/flips when needed. */
export function wrapTransform(t: Transform, content: string): string {
  const transform = rotateFlipTransform(t);
  return transform ? `<g transform="${transform}">${content}</g>` : content;
}
