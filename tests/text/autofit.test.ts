import { describe, expect, it } from 'vitest';
import { estimateTextSize, computeShrinkFactor, defaultFontMetrics } from '../../src/text';
import { defaultParagraph, defaultTextBody, paragraphOf, textRun } from '../../src/core/defaults';
import type { LineBreak } from '../../src/core/types';

const br: LineBreak = { type: 'break' };

function b(...texts: string[]) {
  return defaultTextBody({ paragraphs: texts.map((t) => paragraphOf(t)) });
}

// Default font: size 18 -> charWidth 9.9, lineHeight 21.6.

describe('estimateTextSize', () => {
  it('measures a single line that fits', () => {
    const size = estimateTextSize(b('hello world'), 500);
    expect(size.lines).toBe(1);
    expect(size.width).toBeCloseTo(11 * 9.9, 4);
    expect(size.height).toBeCloseTo(21.6, 4);
  });

  it('wraps greedily at word boundaries', () => {
    // 'hello' = 49.5pt, ' world' would push past 60pt -> two lines
    const size = estimateTextSize(b('hello world'), 60);
    expect(size.lines).toBe(2);
    expect(size.width).toBeCloseTo(49.5, 4);
    expect(size.height).toBeCloseTo(43.2, 4);
  });

  it('a word wider than the box gets its own overflowing line', () => {
    const size = estimateTextSize(b('abcdefghij'), 50);
    expect(size.lines).toBe(1);
    expect(size.width).toBeCloseTo(99, 4);
  });

  it('is deterministic', () => {
    const body = b('the quick brown fox jumps over the lazy dog', 'second paragraph here');
    const a = estimateTextSize(body, 123.4);
    const c = estimateTextSize(body, 123.4);
    expect(a).toEqual(c);
  });

  it('counts each paragraph as at least one line', () => {
    const size = estimateTextSize(b('a', '', 'c'), 500);
    expect(size.lines).toBe(3);
    expect(size.height).toBeCloseTo(3 * 21.6, 4);
  });

  it('line breaks force new lines', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('ab'), br, textRun('cd')] })],
    });
    const size = estimateTextSize(body, 500);
    expect(size.lines).toBe(2);
    expect(size.height).toBeCloseTo(43.2, 4);
  });

  it('lineSpacing multiplies line height', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('hi', { lineSpacing: 2 })] });
    expect(estimateTextSize(body, 500).height).toBeCloseTo(43.2, 4);
  });

  it('adds spaceBefore and spaceAfter', () => {
    const body = defaultTextBody({
      paragraphs: [paragraphOf('hi', { spaceBefore: 10, spaceAfter: 5 })],
    });
    expect(estimateTextSize(body, 500).height).toBeCloseTo(21.6 + 15, 4);
  });

  it('honors wordWrap = false (no wrapping regardless of width)', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('hello world')], wordWrap: false });
    const size = estimateTextSize(body, 10);
    expect(size.lines).toBe(1);
    expect(size.width).toBeCloseTo(108.9, 4);
  });

  it('larger fonts take more space', () => {
    const small = estimateTextSize(b('word'), 500);
    const big = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('word', { size: 36 })] })],
    });
    const bigSize = estimateTextSize(big, 500);
    expect(bigSize.width).toBeCloseTo(small.width * 2, 4);
    expect(bigSize.height).toBeCloseTo(small.height * 2, 4);
  });

  it('accepts a custom fontMetrics function', () => {
    const size = estimateTextSize(b('abcd'), 500, () => ({ charWidth: 10, lineHeight: 20 }));
    expect(size.width).toBe(40);
    expect(size.height).toBe(20);
    expect(size.lines).toBe(1);
  });

  it('default metrics follow the documented formula', () => {
    const m = defaultFontMetrics(textRun('x', { size: 20 }));
    expect(m.charWidth).toBeCloseTo(11, 6);
    expect(m.lineHeight).toBeCloseTo(24, 6);
  });
});

describe('computeShrinkFactor', () => {
  // default insets: 7.2 left/right, 3.6 top/bottom

  it('returns 1 when the text already fits', () => {
    expect(computeShrinkFactor(b('hello world'), { width: 200, height: 30 })).toBe(1);
  });

  it('shrinks in 0.05 steps until the text fits', () => {
    // avail height = 20 - 7.2 = 12.8; line height 21.6 * f <= 12.8 -> f = 0.55
    expect(computeShrinkFactor(b('hello world'), { width: 200, height: 20 })).toBeCloseTo(0.55, 6);
  });

  it('bottoms out at 0.25 when nothing fits', () => {
    expect(computeShrinkFactor(b('hello world overflow'), { width: 20, height: 10 })).toBe(0.25);
  });

  it('never returns a factor outside [0.25, 1]', () => {
    const f = computeShrinkFactor(b('a'), { width: 5000, height: 5000 });
    expect(f).toBe(1);
    const g = computeShrinkFactor(
      b('lots and lots and lots and lots of text that cannot fit at all'),
      { width: 40, height: 15 },
    );
    expect(g).toBeGreaterThanOrEqual(0.25);
    expect(g).toBeLessThanOrEqual(1);
  });

  it('is deterministic', () => {
    const body = b('some text to fit', 'and a second paragraph');
    const box = { width: 120, height: 60 };
    expect(computeShrinkFactor(body, box)).toBe(computeShrinkFactor(body, box));
  });
});
