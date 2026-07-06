import { describe, expect, it } from 'vitest';
import { getParagraphText, getBodyText, paragraphLength, childLength } from '../../src/text';
import { defaultParagraph, defaultTextBody, paragraphOf, textRun } from '../../src/core/defaults';
import type { LineBreak } from '../../src/core/types';

const br: LineBreak = { type: 'break' };

describe('reading', () => {
  it('getParagraphText concatenates runs', () => {
    const p = defaultParagraph({ children: [textRun('Hello '), textRun('world', { bold: true })] });
    expect(getParagraphText(p)).toBe('Hello world');
  });

  it('getParagraphText renders line breaks as \\n', () => {
    const p = defaultParagraph({ children: [textRun('one'), br, textRun('two')] });
    expect(getParagraphText(p)).toBe('one\ntwo');
  });

  it('getParagraphText of an empty paragraph is empty', () => {
    expect(getParagraphText(defaultParagraph())).toBe('');
  });

  it('paragraphLength counts a break as one character', () => {
    const p = defaultParagraph({ children: [textRun('abc'), br, textRun('de')] });
    expect(paragraphLength(p)).toBe(6);
    expect(childLength(br)).toBe(1);
    expect(childLength(textRun('abc'))).toBe(3);
  });

  it('getBodyText joins paragraphs with \\n', () => {
    const body = defaultTextBody({ paragraphs: [paragraphOf('first'), paragraphOf('second'), paragraphOf('')] });
    expect(getBodyText(body)).toBe('first\nsecond\n');
  });

  it('getBodyText of a single empty paragraph is empty', () => {
    expect(getBodyText(defaultTextBody())).toBe('');
  });
});
