/**
 * Slide-level SVG rendering: a complete standalone <svg> document per slide
 * with resolved background, master/layout decorations and slide elements.
 */

import type { Presentation, Slide } from '../core/types';
import { getBodyText } from '../text';
import { effectiveElements, resolveSlideBackground } from '../style';
import { createContext } from './context';
import { renderElements } from './elements';
import { fillAttrValue } from './paint';
import { fmt } from './xml';

export interface RenderSlideOptions {
  /** Output width attribute in px (defaults to the slide width in pt). */
  width?: number;
  /** Output height attribute in px (defaults to keep the slide aspect). */
  height?: number;
}

/**
 * Render a slide to a standalone SVG string. The viewBox is always the full
 * slide size from pres.slideSize; opts.width/height only scale the output.
 */
export function renderSlideSVG(
  pres: Presentation,
  slide: Slide,
  opts: RenderSlideOptions = {},
): string {
  const ctx = createContext(pres, slide);
  const { width: sw, height: sh } = pres.slideSize;

  const bgFill = fillAttrValue(resolveSlideBackground(pres, slide), ctx);
  const background =
    `<rect x="0" y="0" width="${fmt(sw)}" height="${fmt(sh)}"` +
    ` fill="${bgFill === 'none' ? '#FFFFFF' : bgFill}" class="slide-background"/>`;

  const elements = effectiveElements(pres, slide);
  const body = renderElements(elements, ctx);

  const defs = ctx.defs.length > 0 ? `<defs>${ctx.defs.join('')}</defs>` : '';
  const outW = opts.width ?? sw;
  const outH = opts.height ?? (opts.width !== undefined ? (opts.width * sh) / sw : sh);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(outW)}" height="${fmt(outH)}"` +
    ` viewBox="0 0 ${fmt(sw)} ${fmt(sh)}" role="img">${defs}${background}${body}</svg>`
  );
}

/**
 * Render a scaled-down thumbnail of a slide. The drawing coordinate space is
 * unchanged (same viewBox); width/height shrink the rendered output so it
 * fits within maxWidth.
 */
export function renderThumbnailSVG(pres: Presentation, slide: Slide, maxWidth: number): string {
  const { width: sw, height: sh } = pres.slideSize;
  const width = Math.min(maxWidth, sw);
  return renderSlideSVG(pres, slide, { width, height: (width * sh) / sw });
}

/** Plain text of a slide's speaker notes. */
export function renderNotesText(slide: Slide): string {
  return getBodyText(slide.notes);
}
