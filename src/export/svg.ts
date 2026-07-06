/**
 * SVG export: single-slide and whole-presentation SVG string generation.
 */

import type { Presentation } from '../core/types';
import { getVisibleSlides } from '../model';
import { renderSlideSVG } from '../render';

/** Render the slide at `slideIndex` (0-based, counts hidden slides too). */
export function exportSlideSVG(pres: Presentation, slideIndex: number): string {
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= pres.slides.length) {
    throw new RangeError(`slide index ${slideIndex} out of range 0..${pres.slides.length - 1}`);
  }
  return renderSlideSVG(pres, pres.slides[slideIndex]);
}

/** SVG strings for every visible slide, in presentation order. */
export function exportAllSVGs(pres: Presentation): string[] {
  return getVisibleSlides(pres).map((slide) => renderSlideSVG(pres, slide));
}
