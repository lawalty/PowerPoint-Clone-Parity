/**
 * SVG rendering engine — public API.
 */

export { escapeXml, fmt } from './xml';
export { createContext, themeForSlide } from './context';
export type { RenderContext } from './context';
export {
  arrowMarkerId,
  fillAttrValue,
  rotateFlipTransform,
  shadowFilterAttr,
  strokeAttrs,
  wrapTransform,
} from './paint';
export { shapeGeometrySvg } from './shapes';
export { renderTextBody } from './text';
export { renderChart, chartSeriesColor } from './chart';
export { renderTable } from './table';
export { renderElement, renderElements } from './elements';
export { renderSlideSVG, renderThumbnailSVG, renderNotesText } from './slide';
export type { RenderSlideOptions } from './slide';
