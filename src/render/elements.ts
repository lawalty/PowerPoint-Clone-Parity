/**
 * Per-element SVG rendering: dispatches every SlideElement type to its
 * renderer, applying rotation/flips, fills, strokes, effects and text.
 * Hidden elements render to ''.
 */

import type {
  FreeformElement,
  LineElement,
  PictureElement,
  Rect,
  ShapeElement,
  SlideElement,
  TextBoxElement,
} from '../core/types';
import { computeConnectorEndpoints, findElementById } from '../shapes';
import { resolveLine } from '../style';
import type { RenderContext } from './context';
import { renderChart } from './chart';
import {
  arrowMarkerId,
  fillAttrValue,
  rotateFlipTransform,
  shadowFilterAttr,
  strokeAttrs,
  wrapTransform,
} from './paint';
import { shapeGeometrySvg } from './shapes';
import { renderTable } from './table';
import { renderTextBody } from './text';
import { escapeXml, fmt } from './xml';

function boxOf(el: SlideElement): Rect {
  const t = el.transform;
  return { x: t.x, y: t.y, width: t.width, height: t.height };
}

function renderShape(el: ShapeElement, ctx: RenderContext): string {
  const box = boxOf(el);
  const paint =
    ` fill="${fillAttrValue(el.fill, ctx)}"` +
    strokeAttrs(el.line, ctx) +
    shadowFilterAttr(el.effects, ctx);
  const geometry = shapeGeometrySvg(el.geometry, box, el.adjustment, paint);
  const text = renderTextBody(el.textBody, box, ctx);
  return wrapTransform(el.transform, geometry + text);
}

function renderTextBox(el: TextBoxElement, ctx: RenderContext): string {
  const box = boxOf(el);
  const fill = fillAttrValue(el.fill, ctx);
  const stroke = strokeAttrs(el.line, ctx);
  let bg = '';
  if (fill !== 'none' || stroke !== ' stroke="none"') {
    bg =
      `<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}"` +
      ` height="${fmt(box.height)}" fill="${fill}"${stroke}${shadowFilterAttr(el.effects, ctx)}/>`;
  }
  return wrapTransform(el.transform, bg + renderTextBody(el.textBody, box, ctx));
}

function renderPicture(el: PictureElement, ctx: RenderContext): string {
  const box = boxOf(el);
  const title = el.altText ? `<title>${escapeXml(el.altText)}</title>` : '';
  const href = escapeXml(el.src);
  const shadow = shadowFilterAttr(el.effects, ctx);
  const crop = el.crop;
  const cropped = crop.left > 0 || crop.top > 0 || crop.right > 0 || crop.bottom > 0;

  let image: string;
  if (!cropped) {
    image =
      `<image x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}"` +
      ` height="${fmt(box.height)}" href="${href}" preserveAspectRatio="none"${shadow}>` +
      `${title}</image>`;
  } else {
    // The visible (uncropped) fraction of the source must fill the box:
    // scale the full image up and clip it to the element rect.
    const wFrac = Math.max(1 - crop.left - crop.right, 0.01);
    const hFrac = Math.max(1 - crop.top - crop.bottom, 0.01);
    const fullW = box.width / wFrac;
    const fullH = box.height / hFrac;
    const ix = box.x - crop.left * fullW;
    const iy = box.y - crop.top * fullH;
    const clipId = ctx.nextId('clip');
    ctx.defs.push(
      `<clipPath id="${clipId}"><rect x="${fmt(box.x)}" y="${fmt(box.y)}"` +
        ` width="${fmt(box.width)}" height="${fmt(box.height)}"/></clipPath>`,
    );
    image =
      `<g clip-path="url(#${clipId})"${shadow}>` +
      `<image x="${fmt(ix)}" y="${fmt(iy)}" width="${fmt(fullW)}" height="${fmt(fullH)}"` +
      ` href="${href}" preserveAspectRatio="none">${title}</image></g>`;
  }

  const stroke = strokeAttrs(el.line, ctx);
  const border =
    stroke !== ' stroke="none"'
      ? `<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}"` +
        ` height="${fmt(box.height)}" fill="none"${stroke}/>`
      : '';
  return wrapTransform(el.transform, image + border);
}

function renderLine(el: LineElement, ctx: RenderContext, scope: SlideElement[]): string {
  const { start, end } = computeConnectorEndpoints(el, (id) => findElementById(scope, id));
  const stroke = strokeAttrs(el.line, ctx);
  const color = resolveLine(el.line, ctx.scheme).css;
  const headId = arrowMarkerId(el.line.headArrow, color, ctx);
  const tailId = arrowMarkerId(el.line.tailArrow, color, ctx);
  let markers = '';
  if (headId) {
    markers += ` marker-start="url(#${headId})"`;
  }
  if (tailId) {
    markers += ` marker-end="url(#${tailId})"`;
  }

  let content: string;
  if (el.connector === 'straight') {
    content =
      `<line x1="${fmt(start.x)}" y1="${fmt(start.y)}" x2="${fmt(end.x)}" y2="${fmt(end.y)}"` +
      `${stroke}${markers}/>`;
  } else if (el.connector === 'elbow') {
    const midX = (start.x + end.x) / 2;
    const d =
      `M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(midX)} ${fmt(start.y)}` +
      ` L ${fmt(midX)} ${fmt(end.y)} L ${fmt(end.x)} ${fmt(end.y)}`;
    content = `<path d="${d}" fill="none"${stroke}${markers}/>`;
  } else {
    const midX = (start.x + end.x) / 2;
    const d =
      `M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(midX)} ${fmt(start.y)}` +
      ` ${fmt(midX)} ${fmt(end.y)} ${fmt(end.x)} ${fmt(end.y)}`;
    content = `<path d="${d}" fill="none"${stroke}${markers}/>`;
  }

  const transform = rotateFlipTransform({ ...el.transform, flipH: false, flipV: false });
  return transform ? `<g transform="${transform}">${content}</g>` : content;
}

function renderFreeform(el: FreeformElement, ctx: RenderContext): string {
  const t = el.transform;
  const pts = el.path.map((p) => ({
    x: t.x + p.x * t.width,
    y: t.y + p.y * t.height,
    onCurve: p.onCurve,
  }));
  if (pts.length === 0) {
    return '';
  }
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.onCurve) {
      d += ` L ${fmt(p.x)} ${fmt(p.y)}`;
    } else {
      // Off-curve point: quadratic control toward the next point (or the
      // path start when the control point is last).
      const next = pts[i + 1] ?? pts[0];
      d += ` Q ${fmt(p.x)} ${fmt(p.y)} ${fmt(next.x)} ${fmt(next.y)}`;
      i += pts[i + 1] ? 1 : 0;
    }
  }
  if (el.closed) {
    d += ' Z';
  }
  const paint =
    ` fill="${el.closed ? fillAttrValue(el.fill, ctx) : 'none'}"` +
    strokeAttrs(el.line, ctx) +
    shadowFilterAttr(el.effects, ctx);
  return wrapTransform(el.transform, `<path d="${d}"${paint}/>`);
}

/**
 * Render one element (hidden elements yield ''). `scope` is the sibling
 * element list used to resolve connector attachments.
 */
export function renderElement(
  el: SlideElement,
  ctx: RenderContext,
  scope: SlideElement[],
): string {
  if (el.hidden) {
    return '';
  }
  switch (el.type) {
    case 'shape':
      return renderShape(el, ctx);
    case 'textbox':
      return renderTextBox(el, ctx);
    case 'picture':
      return renderPicture(el, ctx);
    case 'line':
      return renderLine(el, ctx, scope);
    case 'freeform':
      return renderFreeform(el, ctx);
    case 'group': {
      // Children are stored relative to the group origin; the group's own
      // rotation/flips apply visually around its absolute center.
      const inner = renderElements(el.children, ctx);
      const parts: string[] = [];
      const rf = rotateFlipTransform(el.transform);
      if (rf) {
        parts.push(rf);
      }
      if (el.transform.x !== 0 || el.transform.y !== 0) {
        parts.push(`translate(${fmt(el.transform.x)} ${fmt(el.transform.y)})`);
      }
      const attr = parts.length > 0 ? ` transform="${parts.join(' ')}"` : '';
      return `<g class="group"${attr}>${inner}</g>`;
    }
    case 'table':
      return renderTable(el, ctx);
    case 'chart':
      return wrapTransform(el.transform, renderChart(el, ctx));
  }
}

/** Render a list of elements in z-order (first = bottom). */
export function renderElements(
  elements: SlideElement[],
  ctx: RenderContext,
  scope: SlideElement[] = elements,
): string {
  return elements.map((el) => renderElement(el, ctx, scope)).join('');
}
