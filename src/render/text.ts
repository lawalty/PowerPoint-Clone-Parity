/**
 * Text body rendering: greedy word wrap (mirroring the estimateTextSize
 * metrics: charWidth = size * 0.55, lineHeight = size * 1.2 * lineSpacing),
 * one <text> element per laid-out line with one <tspan> per run chunk.
 */

import type { Bullet, Paragraph, Rect, TextRun } from '../core/types';
import type { TextBody } from '../core/types';
import { textRun } from '../core/defaults';
import { resolveFont } from '../style';
import { bulletLabel, DEFAULT_CHAR_WIDTH_FACTOR, DEFAULT_LINE_HEIGHT_FACTOR } from '../text';
import type { RenderContext } from './context';
import { escapeXml, fmt } from './xml';

const INDENT_PER_LEVEL = 18;
const BASELINE_FACTOR = 0.8;
const DEFAULT_EMPTY_SIZE = 18;

interface Chunk {
  text: string;
  run: TextRun;
}

interface WrappedLine {
  chunks: Chunk[];
  height: number;
}

interface Token {
  text: string;
  run: TextRun;
  isSpace: boolean;
  width: number;
  height: number;
}

function appendChunk(chunks: Chunk[], text: string, run: TextRun): void {
  const last = chunks[chunks.length - 1];
  if (last && last.run === run) {
    last.text += text;
  } else {
    chunks.push({ text, run });
  }
}

/** Split a paragraph into soft lines (at explicit breaks) of tokens. */
function softLineTokens(p: Paragraph): Token[][] {
  const softLines: Token[][] = [[]];
  for (const child of p.children) {
    if (child.type === 'break') {
      softLines.push([]);
      continue;
    }
    const charWidth = child.font.size * DEFAULT_CHAR_WIDTH_FACTOR;
    const height = child.font.size * DEFAULT_LINE_HEIGHT_FACTOR * p.lineSpacing;
    for (const segment of child.text.match(/\s+|\S+/g) ?? []) {
      softLines[softLines.length - 1].push({
        text: segment,
        run: child,
        isSpace: segment.trim().length === 0,
        width: segment.length * charWidth,
        height,
      });
    }
  }
  return softLines;
}

/** Greedy word wrap of one paragraph into laid-out lines. */
function wrapParagraph(p: Paragraph, availWidth: number): WrappedLine[] {
  const firstRun = p.children.find((c): c is TextRun => c.type === 'run');
  const emptyHeight =
    (firstRun?.font.size ?? DEFAULT_EMPTY_SIZE) * DEFAULT_LINE_HEIGHT_FACTOR * p.lineSpacing;
  const lines: WrappedLine[] = [];

  for (const tokens of softLineTokens(p)) {
    let chunks: Chunk[] = [];
    let lineWidth = 0;
    let lineHeight = 0;
    let pendingSpace: Token | null = null;

    const commit = (): void => {
      lines.push({ chunks, height: lineHeight > 0 ? lineHeight : emptyHeight });
      chunks = [];
      lineWidth = 0;
      lineHeight = 0;
    };

    for (const token of tokens) {
      if (token.isSpace) {
        pendingSpace = token;
        lineHeight = Math.max(lineHeight, token.height);
        continue;
      }
      const spaceWidth = pendingSpace ? pendingSpace.width : 0;
      if (lineWidth > 0 && lineWidth + spaceWidth + token.width > availWidth) {
        commit();
        appendChunk(chunks, token.text, token.run);
        lineWidth = token.width;
        lineHeight = token.height;
      } else {
        if (pendingSpace && chunks.length > 0) {
          appendChunk(chunks, pendingSpace.text, pendingSpace.run);
        }
        appendChunk(chunks, token.text, token.run);
        lineWidth += spaceWidth + token.width;
        lineHeight = Math.max(lineHeight, token.height);
      }
      pendingSpace = null;
    }
    commit();
  }
  return lines;
}

function tspanFor(text: string, run: TextRun, ctx: RenderContext): string {
  const font = resolveFont(run.font, ctx.theme);
  const display = font.capitalization === 'allCaps' ? text.toUpperCase() : text;
  let attrs =
    ` font-family="${escapeXml(font.family)}" font-size="${fmt(font.size)}"` +
    ` fill="${escapeXml(font.color)}"`;
  if (font.bold) {
    attrs += ' font-weight="bold"';
  }
  if (font.italic) {
    attrs += ' font-style="italic"';
  }
  const decorations: string[] = [];
  if (font.underline) {
    decorations.push('underline');
  }
  if (font.strikethrough) {
    decorations.push('line-through');
  }
  if (decorations.length > 0) {
    attrs += ` text-decoration="${decorations.join(' ')}"`;
  }
  if (font.letterSpacing !== 0) {
    attrs += ` letter-spacing="${fmt(font.letterSpacing)}"`;
  }
  if (font.baseline === 'superscript') {
    attrs += ' baseline-shift="super"';
  } else if (font.baseline === 'subscript') {
    attrs += ' baseline-shift="sub"';
  }
  return `<tspan${attrs}>${escapeXml(display)}</tspan>`;
}

/** The visible bullet prefix text for a paragraph, or undefined. */
function bulletPrefix(bullet: Bullet, numberedOrdinal: number): string | undefined {
  if (bullet.type === 'char') {
    return `${bullet.char} `;
  }
  if (bullet.type === 'number') {
    return `${bulletLabel(bullet, numberedOrdinal)} `;
  }
  return undefined;
}

/**
 * Render a TextBody laid out inside `box` (current coordinate space),
 * honoring insets, alignment, vertical alignment, bullets and run styling.
 */
export function renderTextBody(body: TextBody, box: Rect, ctx: RenderContext): string {
  const insets = body.insets;
  const availWidth = body.wordWrap
    ? Math.max(1, box.width - insets.left - insets.right)
    : Number.POSITIVE_INFINITY;

  interface LaidOutParagraph {
    p: Paragraph;
    lines: WrappedLine[];
    prefix: string | undefined;
    prefixRun: TextRun;
  }

  const paragraphs: LaidOutParagraph[] = [];
  let totalHeight = 0;
  let numberedOrdinal = 0;
  for (const p of body.paragraphs) {
    if (p.bullet.type === 'number') {
      numberedOrdinal += 1;
    } else {
      numberedOrdinal = 0;
    }
    const lines = wrapParagraph(p, availWidth);
    const firstRun = p.children.find((c): c is TextRun => c.type === 'run') ?? textRun('');
    const prefix = bulletPrefix(p.bullet, numberedOrdinal);
    let prefixRun = firstRun;
    if (prefix !== undefined && p.bullet.type === 'char' && p.bullet.color) {
      prefixRun = { ...firstRun, font: { ...firstRun.font, color: p.bullet.color } };
    }
    paragraphs.push({ p, lines, prefix, prefixRun });
    totalHeight +=
      p.spaceBefore + lines.reduce((sum, line) => sum + line.height, 0) + p.spaceAfter;
  }

  let cursorY: number;
  switch (body.verticalAlign) {
    case 'middle':
      cursorY = box.y + (box.height - totalHeight) / 2;
      break;
    case 'bottom':
      cursorY = box.y + box.height - insets.bottom - totalHeight;
      break;
    default:
      cursorY = box.y + insets.top;
  }

  const out: string[] = [];
  for (const { p, lines, prefix, prefixRun } of paragraphs) {
    cursorY += p.spaceBefore;
    const indentX = p.level * INDENT_PER_LEVEL;
    let x: number;
    let anchor: 'start' | 'middle' | 'end';
    switch (p.align) {
      case 'center':
        x = box.x + box.width / 2;
        anchor = 'middle';
        break;
      case 'right':
        x = box.x + box.width - insets.right;
        anchor = 'end';
        break;
      default:
        x = box.x + insets.left + indentX;
        anchor = 'start';
    }

    lines.forEach((line, lineIndex) => {
      const baseline = cursorY + line.height * BASELINE_FACTOR;
      cursorY += line.height;
      const spans: string[] = [];
      if (lineIndex === 0 && prefix !== undefined) {
        spans.push(tspanFor(prefix, prefixRun, ctx));
      }
      for (const chunk of line.chunks) {
        if (chunk.text.length > 0) {
          spans.push(tspanFor(chunk.text, chunk.run, ctx));
        }
      }
      if (spans.length > 0) {
        const anchorAttr = anchor === 'start' ? '' : ` text-anchor="${anchor}"`;
        out.push(`<text x="${fmt(x)}" y="${fmt(baseline)}"${anchorAttr}>${spans.join('')}</text>`);
      }
    });
    cursorY += p.spaceAfter;
  }
  return out.join('');
}
