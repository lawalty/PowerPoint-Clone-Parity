import { describe, expect, it } from 'vitest';
import { copyStyle, pasteStyle } from '../../src/style';
import type { Effects, Fill, GroupElement, LineStyle, TextRun } from '../../src/core/types';
import {
  defaultLine,
  defaultParagraph,
  defaultTextBody,
  defaultTransform,
  paragraphOf,
  textRun,
} from '../../src/core/defaults';
import { lineElement, picture, shape, textbox } from './fixtures';

const redFill: Fill = { type: 'solid', color: { type: 'rgb', value: 'FF0000' } };
const thickDashedLine: LineStyle = {
  fill: { type: 'solid', color: { type: 'rgb', value: '112233' } },
  width: 3,
  dash: 'dash',
  cap: 'round',
};
const shadowEffects: Effects = {
  shadow: { color: { type: 'rgb', value: '000000', alpha: 0.5 }, blur: 4, distance: 3, angle: 45 },
};

function styledSourceShape() {
  return shape('src', {
    fill: redFill,
    line: thickDashedLine,
    effects: shadowEffects,
    textBody: defaultTextBody({
      paragraphs: [
        {
          ...defaultParagraph({
            align: 'center',
            bullet: { type: 'char', char: '•' },
            lineSpacing: 1.5,
            spaceBefore: 6,
            spaceAfter: 12,
          }),
          children: [
            textRun('Hello', { family: 'Georgia', size: 30, bold: true, italic: true }),
          ],
        },
      ],
    }),
  });
}

describe('copyStyle', () => {
  it('captures fill, line, effects and text formatting from a shape', () => {
    const snapshot = copyStyle(styledSourceShape());
    expect(snapshot.fill).toEqual(redFill);
    expect(snapshot.line).toEqual(thickDashedLine);
    expect(snapshot.effects).toEqual(shadowEffects);
    expect(snapshot.font?.family).toBe('Georgia');
    expect(snapshot.font?.size).toBe(30);
    expect(snapshot.font?.bold).toBe(true);
    expect(snapshot.paragraph).toEqual({
      align: 'center',
      bullet: { type: 'char', char: '•' },
      lineSpacing: 1.5,
      spaceBefore: 6,
      spaceAfter: 12,
    });
  });

  it('captures only line and effects from a picture', () => {
    const snapshot = copyStyle(picture('pic', { line: thickDashedLine, effects: shadowEffects }));
    expect(snapshot.fill).toBeUndefined();
    expect(snapshot.font).toBeUndefined();
    expect(snapshot.paragraph).toBeUndefined();
    expect(snapshot.line).toEqual(thickDashedLine);
    expect(snapshot.effects).toEqual(shadowEffects);
  });

  it('captures only the line style from a line element', () => {
    const snapshot = copyStyle(lineElement('ln', { line: thickDashedLine }));
    expect(snapshot).toEqual({ line: thickDashedLine });
  });

  it('does not share references with the source element', () => {
    const src = styledSourceShape();
    const snapshot = copyStyle(src);
    src.fill = { type: 'none' };
    (src.textBody.paragraphs[0].children[0] as TextRun).font.size = 8;
    expect(snapshot.fill).toEqual(redFill);
    expect(snapshot.font?.size).toBe(30);
  });

  it('is JSON-serializable', () => {
    const snapshot = copyStyle(styledSourceShape());
    const revived = JSON.parse(JSON.stringify(snapshot));
    expect(revived).toEqual(snapshot);
  });
});

describe('pasteStyle', () => {
  it('applies fill/line/effects and text formatting to ALL runs and paragraphs of a shape', () => {
    const snapshot = copyStyle(styledSourceShape());
    const target = shape('dst', {
      textBody: defaultTextBody({
        paragraphs: [
          { ...paragraphOf('one two', { align: 'right' }), children: [textRun('one'), textRun(' two', { size: 11 })] },
          paragraphOf('three', { align: 'justify', lineSpacing: 2 }),
        ],
      }),
    });

    pasteStyle(target, snapshot);

    expect(target.fill).toEqual(redFill);
    expect(target.line).toEqual(thickDashedLine);
    expect(target.effects).toEqual(shadowEffects);
    for (const paragraph of target.textBody.paragraphs) {
      expect(paragraph.align).toBe('center');
      expect(paragraph.bullet).toEqual({ type: 'char', char: '•' });
      expect(paragraph.lineSpacing).toBe(1.5);
      expect(paragraph.spaceBefore).toBe(6);
      expect(paragraph.spaceAfter).toBe(12);
      for (const child of paragraph.children) {
        if (child.type === 'run') {
          expect(child.font.family).toBe('Georgia');
          expect(child.font.size).toBe(30);
          expect(child.font.bold).toBe(true);
        }
      }
    }
    // Text content itself is untouched.
    expect((target.textBody.paragraphs[0].children[0] as TextRun).text).toBe('one');
    expect((target.textBody.paragraphs[1].children[0] as TextRun).text).toBe('three');
  });

  it('works from a shape onto a textbox', () => {
    const snapshot = copyStyle(styledSourceShape());
    const target = textbox('tb');
    pasteStyle(target, snapshot);
    expect(target.fill).toEqual(redFill);
    expect((target.textBody.paragraphs[0].children[0] as TextRun).font.family).toBe('Georgia');
  });

  it('applies only line and effects to a picture', () => {
    const snapshot = copyStyle(styledSourceShape());
    const target = picture('pic');
    const before = structuredClone(target.crop);
    pasteStyle(target, snapshot);
    expect(target.line).toEqual(thickDashedLine);
    expect(target.effects).toEqual(shadowEffects);
    expect(target.crop).toEqual(before);
    expect((target as unknown as { fill?: Fill }).fill).toBeUndefined();
  });

  it('applies only the line style to a line element', () => {
    const snapshot = copyStyle(styledSourceShape());
    const target = lineElement('ln', { line: defaultLine({ width: 1, dash: 'solid' }) });
    pasteStyle(target, snapshot);
    expect(target.line).toEqual(thickDashedLine);
    expect((target as unknown as { fill?: Fill }).fill).toBeUndefined();
  });

  it('a picture-sourced snapshot leaves a shape fill and text untouched', () => {
    const snapshot = copyStyle(picture('pic', { line: thickDashedLine, effects: shadowEffects }));
    const target = shape('dst');
    const fillBefore = structuredClone(target.fill);
    const sizeBefore = (target.textBody.paragraphs[0].children[0] as TextRun).font.size;
    pasteStyle(target, snapshot);
    expect(target.fill).toEqual(fillBefore);
    expect(target.line).toEqual(thickDashedLine);
    expect((target.textBody.paragraphs[0].children[0] as TextRun).font.size).toBe(sizeBefore);
  });

  it('recurses into groups', () => {
    const snapshot = copyStyle(styledSourceShape());
    const child = shape('child');
    const group: GroupElement = {
      id: 'grp',
      name: 'grp',
      type: 'group',
      transform: defaultTransform(),
      hidden: false,
      locked: false,
      children: [child, lineElement('grp-ln')],
    };
    pasteStyle(group, snapshot);
    expect(child.fill).toEqual(redFill);
    expect((group.children[1] as { line: LineStyle }).line).toEqual(thickDashedLine);
  });

  it('does not share references between snapshot and target', () => {
    const snapshot = copyStyle(styledSourceShape());
    const target = shape('dst');
    pasteStyle(target, snapshot);
    (target.textBody.paragraphs[0].children[0] as TextRun).font.size = 99;
    if (target.fill.type === 'solid' && target.fill.color.type === 'rgb') {
      target.fill.color.value = '00FF00';
    }
    expect(snapshot.font?.size).toBe(30);
    expect(snapshot.fill).toEqual(redFill);
  });

  it('survives a JSON round-trip before pasting', () => {
    const snapshot = JSON.parse(JSON.stringify(copyStyle(styledSourceShape())));
    const target = shape('dst');
    pasteStyle(target, snapshot);
    expect(target.fill).toEqual(redFill);
    expect(target.textBody.paragraphs[0].align).toBe('center');
  });
});
