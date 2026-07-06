import { describe, expect, it } from 'vitest';
import { findInBody, replaceInBody, findInBodies, getBodyText } from '../../src/text';
import { defaultParagraph, defaultTextBody, paragraphOf, textRun } from '../../src/core/defaults';
import type { LineBreak, TextRun } from '../../src/core/types';

const br: LineBreak = { type: 'break' };

function b(...texts: string[]) {
  return defaultTextBody({ paragraphs: texts.map((t) => paragraphOf(t)) });
}

describe('findInBody', () => {
  it('finds all occurrences with paragraph-local offsets', () => {
    const body = b('the cat and the hat', 'the end');
    expect(findInBody(body, 'the')).toEqual([
      { paragraphIndex: 0, start: 0, end: 3 },
      { paragraphIndex: 0, start: 12, end: 15 },
      { paragraphIndex: 1, start: 0, end: 3 },
    ]);
  });

  it('is case-insensitive by default', () => {
    const body = b('Cat cat CAT');
    expect(findInBody(body, 'cat')).toHaveLength(3);
  });

  it('respects matchCase', () => {
    const body = b('Cat cat CAT');
    expect(findInBody(body, 'cat', { matchCase: true })).toEqual([
      { paragraphIndex: 0, start: 4, end: 7 },
    ]);
  });

  it('respects wholeWord', () => {
    const body = b('cat catalog cat.');
    expect(findInBody(body, 'cat', { wholeWord: true })).toEqual([
      { paragraphIndex: 0, start: 0, end: 3 },
      { paragraphIndex: 0, start: 12, end: 15 },
    ]);
  });

  it('combines matchCase and wholeWord', () => {
    const body = b('Cat category cat Cats');
    expect(findInBody(body, 'Cat', { matchCase: true, wholeWord: true })).toEqual([
      { paragraphIndex: 0, start: 0, end: 3 },
    ]);
  });

  it('matches are non-overlapping', () => {
    const body = b('aaaa');
    expect(findInBody(body, 'aa')).toHaveLength(2);
  });

  it('matches across a line break (break renders as \\n)', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('foo'), br, textRun('bar')] })],
    });
    expect(findInBody(body, 'o\nb')).toEqual([{ paragraphIndex: 0, start: 2, end: 5 }]);
  });

  it('an empty query matches nothing', () => {
    expect(findInBody(b('abc'), '')).toEqual([]);
  });
});

describe('replaceInBody', () => {
  it('replaces all matches and returns the count', () => {
    const body = b('one fish two fish', 'red fish');
    const count = replaceInBody(body, 'fish', 'cat');
    expect(count).toBe(3);
    expect(getBodyText(body)).toBe('one cat two cat\nred cat');
  });

  it('preserves the formatting of the first character of each match', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('foo ', { bold: true }), textRun('foo plain')] })],
    });
    const count = replaceInBody(body, 'foo', 'barbar');
    expect(count).toBe(2);
    const runs = body.paragraphs[0].children as TextRun[];
    expect(getBodyText(body)).toBe('barbar barbar plain');
    expect(runs[0].font.bold).toBe(true);
    expect(runs[0].text).toBe('barbar ');
    expect(runs[1].font.bold).toBe(false);
  });

  it('a match spanning formats takes the first character format', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('a', { italic: true }), textRun('b')] })],
    });
    replaceInBody(body, 'ab', 'XY');
    const runs = body.paragraphs[0].children as TextRun[];
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('XY');
    expect(runs[0].font.italic).toBe(true);
  });

  it('preserves the hyperlink of the replaced text', () => {
    const linked: TextRun = { ...textRun('click here'), hyperlink: 'https://x.test' };
    const body = defaultTextBody({ paragraphs: [defaultParagraph({ children: [linked] })] });
    replaceInBody(body, 'here', 'now');
    const runs = body.paragraphs[0].children as TextRun[];
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('click now');
    expect(runs[0].hyperlink).toBe('https://x.test');
  });

  it('handles replacements longer and shorter than the query in one paragraph', () => {
    const body = b('aa bb aa bb aa');
    expect(replaceInBody(body, 'aa', 'zzzz')).toBe(3);
    expect(getBodyText(body)).toBe('zzzz bb zzzz bb zzzz');
    expect(replaceInBody(body, 'zzzz', 'q')).toBe(3);
    expect(getBodyText(body)).toBe('q bb q bb q');
  });

  it('an empty replacement deletes the matches', () => {
    const body = b('strip me: xx and xx');
    expect(replaceInBody(body, 'xx', '')).toBe(2);
    expect(getBodyText(body)).toBe('strip me:  and ');
  });

  it('respects find options during replace', () => {
    const body = b('Case case CASE');
    expect(replaceInBody(body, 'case', 'x', { matchCase: true })).toBe(1);
    expect(getBodyText(body)).toBe('Case x CASE');
  });

  it('returns 0 when nothing matches', () => {
    const body = b('nothing here');
    expect(replaceInBody(body, 'zebra', 'x')).toBe(0);
    expect(getBodyText(body)).toBe('nothing here');
  });
});

describe('findInBodies', () => {
  it('tags matches with their element id across multiple bodies', () => {
    const results = findInBodies(
      [
        { elementId: 'title-1', body: b('Sales Report') },
        { elementId: 'body-1', body: b('Quarterly sales are up', 'sales sales') },
      ],
      'sales',
    );
    expect(results).toEqual([
      { elementId: 'title-1', paragraphIndex: 0, start: 0, end: 5 },
      { elementId: 'body-1', paragraphIndex: 0, start: 10, end: 15 },
      { elementId: 'body-1', paragraphIndex: 1, start: 0, end: 5 },
      { elementId: 'body-1', paragraphIndex: 1, start: 6, end: 11 },
    ]);
  });

  it('passes options through', () => {
    const results = findInBodies(
      [{ elementId: 'e1', body: b('Sales salesperson') }],
      'Sales',
      { matchCase: true, wholeWord: true },
    );
    expect(results).toHaveLength(1);
    expect(results[0].start).toBe(0);
  });
});
