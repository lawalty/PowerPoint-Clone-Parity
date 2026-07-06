/**
 * Public types for the rich text engine.
 *
 * A text position within a Paragraph is a character offset into the
 * concatenation of its runs' text (a LineBreak counts as 1 character, '\n').
 * A position within a TextBody is {paragraphIndex, offset}.
 */

import type { Id, Paragraph, TextRun } from '../core/types';

/** A caret position inside a TextBody. */
export interface TextPosition {
  paragraphIndex: number;
  /** Character offset into the paragraph's concatenated text. */
  offset: number;
}

export interface FindOptions {
  /** Case-sensitive match. Default false. */
  matchCase?: boolean;
  /** Match whole words only. Default false. */
  wholeWord?: boolean;
}

/** A match inside a single TextBody. `end` is exclusive. */
export interface FindMatch {
  paragraphIndex: number;
  start: number;
  end: number;
}

/** A match tagged with the element it was found in. */
export interface TaggedFindMatch extends FindMatch {
  elementId: Id;
}

/** Input entry for findInBodies. */
export interface BodySource {
  elementId: Id;
  body: import('../core/types').TextBody;
}

/** Result of estimateTextSize. */
export interface TextMeasurement {
  width: number;
  height: number;
  /** Total number of laid-out (wrapped) lines. */
  lines: number;
}

/** Per-run metrics used by the autofit estimator. */
export interface RunMetrics {
  /** Average advance width of one character, in points. */
  charWidth: number;
  /** Height of a line of this run's font, in points (before lineSpacing). */
  lineHeight: number;
}

export type FontMetricsFn = (run: TextRun) => RunMetrics;

/** FontRef keys that can be toggled on/off like PowerPoint toolbar buttons. */
export type ToggleableFormatKey = 'bold' | 'italic' | 'underline' | 'strikethrough';

/** Paragraph-level format patch (children are never touched by it). */
export type ParagraphFormatPatch = Partial<Omit<Paragraph, 'children'>>;
