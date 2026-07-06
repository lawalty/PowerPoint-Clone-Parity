import { describe, expect, it } from 'vitest';
import {
  applyCharFormat,
  toggleFormat,
  getFormatAt,
  rangeHasUniformFormat,
  setHyperlink,
  removeHyperlink,
  getBodyText,
} from '../../src/text';
import {
  defaultFont,
  defaultParagraph,
  defaultTextBody,
  paragraphOf,
  rgb,
  textRun,
} from '../../src/core/defaults';
import type { TextRun } from '../../src/core/types';

const pos = (paragraphIndex: number, offset: number) => ({ paragraphIndex, offset });

function runs(body: ReturnType<typeof defaultTextBody>, pi = 0): TextRun[] {
  return body.paragraphs[pi].children as TextRun[];
}

describe('applyCharFormat', () => {
  it('splits runs exactly at range boundaries', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('Hello world')] });
    applyCharFormat(body, pos(0, 6), pos(0, 11), { italic: true });
    const r = runs(body);
    expect(r).toHaveLength(2);
    expect(r[0].text).toBe('Hello ');
    expect(r[0].font.italic).toBe(false);
    expect(r[1].text).toBe('world');
    expect(r[1].font.italic).toBe(true);
  });

  it('splits a run in the middle for an interior range', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('abcdef')] });
    applyCharFormat(body, pos(0, 2), pos(0, 4), { bold: true });
    const r = runs(body);
    expect(r.map((x) => x.text)).toEqual(['ab', 'cd', 'ef']);
    expect(r.map((x) => x.font.bold)).toEqual([false, true, false]);
  });

  it('does not split further when the range aligns with existing run boundaries', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('AAA', { bold: true }), textRun('BBB')] })],
    });
    applyCharFormat(body, pos(0, 3), pos(0, 6), { underline: true });
    const r = runs(body);
    expect(r).toHaveLength(2);
    expect(r[0].text).toBe('AAA');
    expect(r[0].font.underline).toBe(false);
    expect(r[1].font.underline).toBe(true);
  });

  it('applies across paragraph boundaries', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('first'), paragraphOf('second')] });
    applyCharFormat(body, pos(0, 3), pos(1, 3), { bold: true });
    expect(runs(body, 0).map((r) => [r.text, r.font.bold])).toEqual([
      ['fir', false],
      ['st', true],
    ]);
    expect(runs(body, 1).map((r) => [r.text, r.font.bold])).toEqual([
      ['sec', true],
      ['ond', false],
    ]);
  });

  it('re-normalizes runs when the patch makes neighbors identical', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('Hello ', { bold: true }), textRun('world')] })],
    });
    applyCharFormat(body, pos(0, 6), pos(0, 11), { bold: true });
    expect(runs(body)).toHaveLength(1);
    expect(runs(body)[0].text).toBe('Hello world');
  });

  it('applies non-boolean properties like size and color', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('color me')] });
    applyCharFormat(body, pos(0, 0), pos(0, 5), { size: 32, color: rgb('FF0000') });
    const r = runs(body);
    expect(r[0].font.size).toBe(32);
    expect(r[0].font.color).toEqual({ type: 'rgb', value: 'FF0000' });
    expect(r[1].font.size).toBe(18);
  });

  it('a collapsed range changes nothing', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('abc')] });
    applyCharFormat(body, pos(0, 1), pos(0, 1), { bold: true });
    expect(runs(body)).toHaveLength(1);
    expect(runs(body)[0].font.bold).toBe(false);
  });

  it('does not change the text content', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('unchanged text')] });
    applyCharFormat(body, pos(0, 2), pos(0, 9), { strikethrough: true });
    expect(getBodyText(body)).toBe('unchanged text');
  });
});

describe('toggleFormat', () => {
  it('applies the attribute when the range is mixed', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('Hello ', { bold: true }), textRun('world')] })],
    });
    toggleFormat(body, pos(0, 0), pos(0, 11), 'bold');
    expect(runs(body)).toHaveLength(1);
    expect(runs(body)[0].font.bold).toBe(true);
  });

  it('removes the attribute when the whole range already has it', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('all bold', { bold: true })] })],
    });
    toggleFormat(body, pos(0, 0), pos(0, 8), 'bold');
    expect(runs(body)[0].font.bold).toBe(false);
  });

  it('double toggle round-trips', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('plain')] });
    toggleFormat(body, pos(0, 0), pos(0, 5), 'italic');
    expect(runs(body)[0].font.italic).toBe(true);
    toggleFormat(body, pos(0, 0), pos(0, 5), 'italic');
    expect(runs(body)[0].font.italic).toBe(false);
    expect(runs(body)).toHaveLength(1);
  });

  it('toggles underline and strikethrough on a sub-range', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('abcdef')] });
    toggleFormat(body, pos(0, 1), pos(0, 3), 'underline');
    toggleFormat(body, pos(0, 1), pos(0, 3), 'strikethrough');
    const r = runs(body);
    expect(r[1].text).toBe('bc');
    expect(r[1].font.underline).toBe(true);
    expect(r[1].font.strikethrough).toBe(true);
    expect(r[0].font.underline).toBe(false);
  });

  it('works across paragraphs with PowerPoint semantics', () => {
    const body = defaultTextBody({
      paragraphs: [
        defaultParagraph({ children: [textRun('one', { bold: true })] }),
        defaultParagraph({ children: [textRun('two')] }),
      ],
    });
    // mixed -> everything becomes bold
    toggleFormat(body, pos(0, 0), pos(1, 3), 'bold');
    expect(runs(body, 0)[0].font.bold).toBe(true);
    expect(runs(body, 1)[0].font.bold).toBe(true);
    // uniform -> everything loses bold
    toggleFormat(body, pos(0, 0), pos(1, 3), 'bold');
    expect(runs(body, 0)[0].font.bold).toBe(false);
    expect(runs(body, 1)[0].font.bold).toBe(false);
  });
});

describe('getFormatAt / rangeHasUniformFormat', () => {
  it('getFormatAt returns the font of the run ending at the position', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('bold', { bold: true }), textRun('plain')] })],
    });
    expect(getFormatAt(body, pos(0, 4)).bold).toBe(true);
    expect(getFormatAt(body, pos(0, 5)).bold).toBe(false); // interior of the 'plain' run
    expect(getFormatAt(body, pos(0, 9)).bold).toBe(false); // end of paragraph
  });

  it('getFormatAt at offset 0 returns the first run font', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('x', { italic: true })] })],
    });
    expect(getFormatAt(body, pos(0, 0)).italic).toBe(true);
  });

  it('getFormatAt in an empty paragraph returns the default font', () => {
    const body = defaultTextBody();
    expect(getFormatAt(body, pos(0, 0))).toEqual(defaultFont());
  });

  it('getFormatAt returns a detached copy', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('abc')] });
    const font = getFormatAt(body, pos(0, 2));
    font.bold = true;
    expect((body.paragraphs[0].children[0] as TextRun).font.bold).toBe(false);
  });

  it('rangeHasUniformFormat returns the common value', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('ab', { bold: true }), textRun('cd', { bold: true, italic: true })] })],
    });
    expect(rangeHasUniformFormat(body, pos(0, 0), pos(0, 4), 'bold')).toBe(true);
    expect(rangeHasUniformFormat(body, pos(0, 0), pos(0, 4), 'size')).toBe(18);
  });

  it('rangeHasUniformFormat returns undefined for mixed values', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('ab', { bold: true }), textRun('cd')] })],
    });
    expect(rangeHasUniformFormat(body, pos(0, 0), pos(0, 4), 'bold')).toBeUndefined();
    // sub-range covering only the bold run is uniform
    expect(rangeHasUniformFormat(body, pos(0, 0), pos(0, 2), 'bold')).toBe(true);
    expect(rangeHasUniformFormat(body, pos(0, 2), pos(0, 4), 'bold')).toBe(false);
  });

  it('rangeHasUniformFormat compares structured values like color', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('ab', { color: rgb('112233') }), textRun('cd', { color: rgb('112233') })] })],
    });
    expect(rangeHasUniformFormat(body, pos(0, 0), pos(0, 4), 'color')).toEqual(rgb('112233'));
  });

  it('rangeHasUniformFormat returns undefined for an empty range', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('abc')] });
    expect(rangeHasUniformFormat(body, pos(0, 1), pos(0, 1), 'bold')).toBeUndefined();
  });
});

describe('hyperlinks', () => {
  it('setHyperlink applies exactly to the range', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('visit our site today')] });
    setHyperlink(body, pos(0, 6), pos(0, 14), 'https://example.com');
    const r = runs(body);
    expect(r.map((x) => x.text)).toEqual(['visit ', 'our site', ' today']);
    expect(r[0].hyperlink).toBeUndefined();
    expect(r[1].hyperlink).toBe('https://example.com');
    expect(r[2].hyperlink).toBeUndefined();
  });

  it('runs with different hyperlinks never merge', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('one two')] });
    setHyperlink(body, pos(0, 0), pos(0, 3), 'https://a.test');
    setHyperlink(body, pos(0, 3), pos(0, 7), 'https://b.test');
    expect(runs(body)).toHaveLength(2);
  });

  it('removeHyperlink clears links and lets runs merge back', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('click here now')] });
    setHyperlink(body, pos(0, 6), pos(0, 10), 'https://x.test');
    removeHyperlink(body, pos(0, 0), pos(0, 14));
    const r = runs(body);
    expect(r).toHaveLength(1);
    expect(r[0].hyperlink).toBeUndefined();
    expect(r[0].text).toBe('click here now');
  });

  it('setHyperlink across paragraphs', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('first'), paragraphOf('second')] });
    setHyperlink(body, pos(0, 2), pos(1, 3), 'https://multi.test');
    expect(runs(body, 0)[1].hyperlink).toBe('https://multi.test');
    expect(runs(body, 1)[0].hyperlink).toBe('https://multi.test');
    expect(runs(body, 1)[1].hyperlink).toBeUndefined();
  });
});
