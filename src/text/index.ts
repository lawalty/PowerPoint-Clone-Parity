/**
 * Rich text engine: reading, editing, character & paragraph formatting,
 * lists, hyperlinks, find & replace, and autofit estimation for TextBody.
 *
 * All mutating operations edit the given TextBody in place and return it.
 */

export type {
  TextPosition,
  FindOptions,
  FindMatch,
  TaggedFindMatch,
  BodySource,
  TextMeasurement,
  RunMetrics,
  FontMetricsFn,
  ToggleableFormatKey,
  ParagraphFormatPatch,
} from './types';

export { childLength, getParagraphText, getBodyText, paragraphLength } from './read';

export { insertText, deleteRange, splitParagraph, mergeWithPrevious, endOfBody } from './edit';

export { applyCharFormat, toggleFormat, getFormatAt, rangeHasUniformFormat } from './format';

export {
  applyParagraphFormat,
  setAlignment,
  setLineSpacing,
  setSpaceBefore,
  setSpaceAfter,
} from './paragraph';

export {
  toggleBulletList,
  toggleNumberedList,
  indent,
  outdent,
  bulletLabel,
  toRoman,
  toAlpha,
  MIN_LIST_LEVEL,
  MAX_LIST_LEVEL,
} from './lists';

export { setHyperlink, removeHyperlink } from './hyperlink';

export { findInBody, replaceInBody, findInBodies } from './find';

export {
  estimateTextSize,
  computeShrinkFactor,
  defaultFontMetrics,
  DEFAULT_CHAR_WIDTH_FACTOR,
  DEFAULT_LINE_HEIGHT_FACTOR,
  SHRINK_MIN,
  SHRINK_STEP,
} from './autofit';
