/**
 * Fill and stroke attribute generation. Solid fills become plain attribute
 * values; gradient/pattern/picture fills emit <defs> entries with unique ids
 * and reference them via url(#id).
 */

import type { Fill, LineStyle, Transform } from '../core/types';
import {
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
