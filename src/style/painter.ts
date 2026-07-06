/**
 * Format painter: copy the visual style of one element into a serializable
 * snapshot, then paste whatever parts a target element supports.
 */

import type {
  Bullet,
  Effects,
  Fill,
  FontRef,
  LineStyle,
  SlideElement,
  TextAlign,
  TextBody,
  TextRun,
} from '../core/types';
import { deepClone } from '../core/util';

export interface ParagraphStyleSnapshot {
  align: TextAlign;
  bullet: Bullet;
  lineSpacing: number;
  spaceBefore: number;
  spaceAfter: number;
}

/** Serializable capture of an element's visual style. */
export interface StyleSnapshot {
  fill?: Fill;
  line?: LineStyle;
  effects?: Effects;
  /** First run's font, for text-bearing elements. */
  font?: FontRef;
  /** First paragraph's alignment/bullet/spacing, for text-bearing elements. */
  paragraph?: ParagraphStyleSnapshot;
}

function firstRun(textBody: TextBody): TextRun | undefined {
  for (const paragraph of textBody.paragraphs) {
    for (const child of paragraph.children) {
      if (child.type === 'run') {
        return child;
      }
    }
  }
  return undefined;
}

function captureText(snapshot: StyleSnapshot, textBody: TextBody): void {
  const run = firstRun(textBody);
  if (run) {
    snapshot.font = deepClone(run.font);
  }
  const paragraph = textBody.paragraphs[0];
  if (paragraph) {
    snapshot.paragraph = {
      align: paragraph.align,
      bullet: deepClone(paragraph.bullet),
      lineSpacing: paragraph.lineSpacing,
      spaceBefore: paragraph.spaceBefore,
      spaceAfter: paragraph.spaceAfter,
    };
  }
}

/** Capture a serializable style snapshot from an element. */
export function copyStyle(el: SlideElement): StyleSnapshot {
  const snapshot: StyleSnapshot = {};
  switch (el.type) {
    case 'shape':
    case 'textbox':
      snapshot.fill = deepClone(el.fill);
      snapshot.line = deepClone(el.line);
      snapshot.effects = deepClone(el.effects);
      captureText(snapshot, el.textBody);
      break;
    case 'freeform':
      snapshot.fill = deepClone(el.fill);
      snapshot.line = deepClone(el.line);
      snapshot.effects = deepClone(el.effects);
      break;
    case 'picture':
      snapshot.line = deepClone(el.line);
      snapshot.effects = deepClone(el.effects);
      break;
    case 'line':
      snapshot.line = deepClone(el.line);
      break;
    case 'group':
    case 'table':
    case 'chart':
      // No directly paintable style on these containers.
      break;
  }
  return snapshot;
}

function pasteText(textBody: TextBody, snapshot: StyleSnapshot): void {
  for (const paragraph of textBody.paragraphs) {
    if (snapshot.paragraph) {
      paragraph.align = snapshot.paragraph.align;
      paragraph.bullet = deepClone(snapshot.paragraph.bullet);
      paragraph.lineSpacing = snapshot.paragraph.lineSpacing;
      paragraph.spaceBefore = snapshot.paragraph.spaceBefore;
      paragraph.spaceAfter = snapshot.paragraph.spaceAfter;
    }
    if (snapshot.font) {
      for (const child of paragraph.children) {
        if (child.type === 'run') {
          child.font = deepClone(snapshot.font);
        }
      }
    }
  }
}

/**
 * Apply the parts of a snapshot the target element supports (mutates el):
 * - shape/textbox: fill, line, effects + text formatting on ALL runs/paragraphs
 * - freeform: fill, line, effects
 * - picture: line, effects only
 * - line element: line style only
 * - group: recurses into children.
 */
export function pasteStyle(el: SlideElement, snapshot: StyleSnapshot): void {
  switch (el.type) {
    case 'shape':
    case 'textbox':
      if (snapshot.fill) {
        el.fill = deepClone(snapshot.fill);
      }
      if (snapshot.line) {
        el.line = deepClone(snapshot.line);
      }
      if (snapshot.effects) {
        el.effects = deepClone(snapshot.effects);
      }
      pasteText(el.textBody, snapshot);
      break;
    case 'freeform':
      if (snapshot.fill) {
        el.fill = deepClone(snapshot.fill);
      }
      if (snapshot.line) {
        el.line = deepClone(snapshot.line);
      }
      if (snapshot.effects) {
        el.effects = deepClone(snapshot.effects);
      }
      break;
    case 'picture':
      if (snapshot.line) {
        el.line = deepClone(snapshot.line);
      }
      if (snapshot.effects) {
        el.effects = deepClone(snapshot.effects);
      }
      break;
    case 'line':
      if (snapshot.line) {
        el.line = deepClone(snapshot.line);
      }
      break;
    case 'group':
      for (const child of el.children) {
        pasteStyle(child, snapshot);
      }
      break;
    case 'table':
    case 'chart':
      break;
  }
}
