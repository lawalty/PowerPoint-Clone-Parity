import { describe, expect, it } from 'vitest';
import {
  insertText,
  deleteRange,
  splitParagraph,
  mergeWithPrevious,
  getBodyText,
  getParagraphText,
  endOfBody,
} from '../../src/text';
import {
  defaultFont,
  defaultParagraph,
  defaultTextBody,
  paragraphOf,
  textRun,
} from '../../src/core/defaults';
import type { LineBreak, TextRun } from '../../src/core/types';

const br: LineBreak = { type: 'break' };
const run = (i: number, body = b()): TextRun => body.paragraphs[0].children[i] as TextRun;

function b(...texts: string[]) {
  return defaultTextBody({ paragraphs: texts.map((t) => paragraphOf(t)) });
}

describe('insertText', () => {
  it('inserts plain text at an offset', () => {
    const body = b('Hello world');
    insertText(body, { paragraphIndex: 0, offset: 5 }, ',');
    expect(getBodyText(body)).toBe('Hello, world');
  });

  it('inherits formatting from the run ending at the insertion point', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('Hello', { bold: true }), textRun(' world')] })],
    });
    insertText(body, { paragraphIndex: 0, offset: 5 }, '!!');
    const first = body.paragraphs[0].children[0] as TextRun;
    expect(first.text).toBe('Hello!!');
    expect(first.font.bold).toBe(true);
    // normalization keeps exactly two runs
    expect(body.paragraphs[0].children).toHaveLength(2);
  });

  it('inherits formatting from the run at the start when inserting at offset 0', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('abc', { italic: true })] })],
    });
    insertText(body, { paragraphIndex: 0, offset: 0 }, 'X');
    const only = body.paragraphs[0].children[0] as TextRun;
    expect(only.text).toBe('Xabc');
    expect(only.font.italic).toBe(true);
    expect(body.paragraphs[0].children).toHaveLength(1);
  });

  it('inherits interior-run formatting (including hyperlink) when inserting mid-run', () => {
    const linked: TextRun = { ...textRun('linked', { underline: true }), hyperlink: 'https://x.test' };
    const body = defaultTextBody({ paragraphs: [defaultParagraph({ children: [linked] })] });
    insertText(body, { paragraphIndex: 0, offset: 3 }, 'ZZ');
    expect(body.paragraphs[0].children).toHaveLength(1);
    const only = body.paragraphs[0].children[0] as TextRun;
    expect(only.text).toBe('linZZked');
    expect(only.hyperlink).toBe('https://x.test');
    expect(only.font.underline).toBe(true);
  });

  it('uses the default font when inserting into an empty paragraph', () => {
    const body = defaultTextBody();
    insertText(body, { paragraphIndex: 0, offset: 0 }, 'new');
    const only = body.paragraphs[0].children[0] as TextRun;
    expect(only.font).toEqual(defaultFont());
    expect(getBodyText(body)).toBe('new');
  });

  it('splits paragraphs on \\n in the inserted text', () => {
    const body = b('Hello world');
    insertText(body, { paragraphIndex: 0, offset: 5 }, 'X\nY');
    expect(body.paragraphs).toHaveLength(2);
    expect(getParagraphText(body.paragraphs[0])).toBe('HelloX');
    expect(getParagraphText(body.paragraphs[1])).toBe('Y world');
  });

  it('creates empty middle paragraphs for consecutive \\n', () => {
    const body = b('ab');
    insertText(body, { paragraphIndex: 0, offset: 1 }, '1\n\n2');
    expect(body.paragraphs).toHaveLength(3);
    expect(getBodyText(body)).toBe('a1\n\n2b');
    expect(body.paragraphs[1].children).toHaveLength(0);
  });

  it('copies paragraph properties to paragraphs created by \\n', () => {
    const body = defaultTextBody({
      paragraphs: [paragraphOf('Hello', { align: 'center', level: 3, spaceAfter: 12 })],
    });
    insertText(body, { paragraphIndex: 0, offset: 5 }, '\nWorld');
    expect(body.paragraphs[1].align).toBe('center');
    expect(body.paragraphs[1].level).toBe(3);
    expect(body.paragraphs[1].spaceAfter).toBe(12);
  });

  it('inserting an empty string is a no-op', () => {
    const body = b('abc');
    insertText(body, { paragraphIndex: 0, offset: 1 }, '');
    expect(getBodyText(body)).toBe('abc');
    expect(body.paragraphs[0].children).toHaveLength(1);
  });

  it('clamps out-of-range positions', () => {
    const body = b('abc');
    insertText(body, { paragraphIndex: 9, offset: 99 }, '!');
    expect(getBodyText(body)).toBe('abc!');
  });
});

describe('deleteRange', () => {
  it('deletes within a single paragraph', () => {
    const body = b('Hello world');
    deleteRange(body, { paragraphIndex: 0, offset: 5 }, { paragraphIndex: 0, offset: 11 });
    expect(getBodyText(body)).toBe('Hello');
  });

  it('deletes across multiple paragraphs and merges the survivors', () => {
    const body = b('Hello world', 'Middle line', 'Second para');
    deleteRange(body, { paragraphIndex: 0, offset: 5 }, { paragraphIndex: 2, offset: 6 });
    expect(body.paragraphs).toHaveLength(1);
    expect(getBodyText(body)).toBe('Hello para');
  });

  it('merges paragraphs when just the boundary is deleted', () => {
    const body = b('Hello', 'World');
    deleteRange(body, { paragraphIndex: 0, offset: 5 }, { paragraphIndex: 1, offset: 0 });
    expect(body.paragraphs).toHaveLength(1);
    expect(getBodyText(body)).toBe('HelloWorld');
  });

  it('keeps the first paragraph properties on a cross-paragraph delete', () => {
    const body = defaultTextBody({
      paragraphs: [paragraphOf('one', { align: 'right' }), paragraphOf('two', { align: 'center' })],
    });
    deleteRange(body, { paragraphIndex: 0, offset: 1 }, { paragraphIndex: 1, offset: 1 });
    expect(body.paragraphs).toHaveLength(1);
    expect(getBodyText(body)).toBe('owo');
    expect(body.paragraphs[0].align).toBe('right');
  });

  it('deletes a line break inside a paragraph', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('ab'), br, textRun('cd')] })],
    });
    deleteRange(body, { paragraphIndex: 0, offset: 2 }, { paragraphIndex: 0, offset: 3 });
    expect(getBodyText(body)).toBe('abcd');
    // identical formats merge back into a single run
    expect(body.paragraphs[0].children).toHaveLength(1);
  });

  it('preserves formatting of the surviving halves', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('bold!', { bold: true }), textRun('plain')] })],
    });
    deleteRange(body, { paragraphIndex: 0, offset: 3 }, { paragraphIndex: 0, offset: 7 });
    const children = body.paragraphs[0].children as TextRun[];
    expect(children).toHaveLength(2);
    expect(children[0].text).toBe('bol');
    expect(children[0].font.bold).toBe(true);
    expect(children[1].text).toBe('ain');
    expect(children[1].font.bold).toBe(false);
  });

  it('accepts start and end in either order', () => {
    const body = b('Hello world');
    deleteRange(body, { paragraphIndex: 0, offset: 11 }, { paragraphIndex: 0, offset: 5 });
    expect(getBodyText(body)).toBe('Hello');
  });

  it('collapsed range is a no-op', () => {
    const body = b('abc');
    deleteRange(body, { paragraphIndex: 0, offset: 1 }, { paragraphIndex: 0, offset: 1 });
    expect(getBodyText(body)).toBe('abc');
  });

  it('can delete the entire body text leaving one empty paragraph', () => {
    const body = b('one', 'two', 'three');
    deleteRange(body, { paragraphIndex: 0, offset: 0 }, endOfBody(body));
    expect(body.paragraphs).toHaveLength(1);
    expect(body.paragraphs[0].children).toHaveLength(0);
    expect(getBodyText(body)).toBe('');
  });
});

describe('splitParagraph / mergeWithPrevious', () => {
  it('splits a paragraph at the position (Enter key)', () => {
    const body = b('Hello world');
    splitParagraph(body, { paragraphIndex: 0, offset: 5 });
    expect(body.paragraphs).toHaveLength(2);
    expect(getParagraphText(body.paragraphs[0])).toBe('Hello');
    expect(getParagraphText(body.paragraphs[1])).toBe(' world');
  });

  it('copies paragraph properties and clones the bullet on split', () => {
    const body = defaultTextBody({
      paragraphs: [
        paragraphOf('Hello world', {
          align: 'center',
          level: 2,
          bullet: { type: 'char', char: '•' },
          spaceAfter: 6,
        }),
      ],
    });
    splitParagraph(body, { paragraphIndex: 0, offset: 5 });
    const [p0, p1] = body.paragraphs;
    expect(p1.align).toBe('center');
    expect(p1.level).toBe(2);
    expect(p1.spaceAfter).toBe(6);
    expect(p1.bullet).toEqual(p0.bullet);
    expect(p1.bullet).not.toBe(p0.bullet);
  });

  it('splitting at the end creates an empty paragraph', () => {
    const body = b('abc');
    splitParagraph(body, { paragraphIndex: 0, offset: 3 });
    expect(body.paragraphs).toHaveLength(2);
    expect(body.paragraphs[1].children).toHaveLength(0);
  });

  it('splitting mid-run keeps run formatting on both sides', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('bolded', { bold: true })] })],
    });
    splitParagraph(body, { paragraphIndex: 0, offset: 3 });
    expect((body.paragraphs[0].children[0] as TextRun).font.bold).toBe(true);
    expect((body.paragraphs[1].children[0] as TextRun).font.bold).toBe(true);
  });

  it('mergeWithPrevious joins two paragraphs (Backspace at start)', () => {
    const body = b('Hello', 'world');
    mergeWithPrevious(body, 1);
    expect(body.paragraphs).toHaveLength(1);
    expect(getBodyText(body)).toBe('Helloworld');
    // identical default formats merge into one run
    expect(body.paragraphs[0].children).toHaveLength(1);
  });

  it('mergeWithPrevious keeps distinct formats as separate runs', () => {
    const body = defaultTextBody({
      paragraphs: [
        defaultParagraph({ children: [textRun('a', { bold: true })] }),
        defaultParagraph({ children: [textRun('b')] }),
      ],
    });
    mergeWithPrevious(body, 1);
    expect(body.paragraphs[0].children).toHaveLength(2);
  });

  it('mergeWithPrevious is a no-op for the first paragraph and bad indices', () => {
    const body = b('a', 'b');
    mergeWithPrevious(body, 0);
    mergeWithPrevious(body, 5);
    expect(body.paragraphs).toHaveLength(2);
  });

  it('split then merge round-trips the text', () => {
    const body = b('roundtrip');
    splitParagraph(body, { paragraphIndex: 0, offset: 5 });
    mergeWithPrevious(body, 1);
    expect(getBodyText(body)).toBe('roundtrip');
    expect(body.paragraphs).toHaveLength(1);
  });
});

describe('run normalization after edits', () => {
  it('drops empty runs and merges identical neighbors', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('ab'), textRun(''), textRun('cd')] })],
    });
    insertText(body, { paragraphIndex: 0, offset: 2 }, 'X');
    expect(body.paragraphs[0].children).toHaveLength(1);
    expect(run(0, body).text).toBe('abXcd');
  });

  it('keeps breaks intact during normalization', () => {
    const body = defaultTextBody({
      paragraphs: [defaultParagraph({ children: [textRun('a'), br, textRun('b')] })],
    });
    insertText(body, { paragraphIndex: 0, offset: 1 }, 'x');
    expect(body.paragraphs[0].children).toHaveLength(3);
    expect(getParagraphText(body.paragraphs[0])).toBe('ax\nb');
  });
});
