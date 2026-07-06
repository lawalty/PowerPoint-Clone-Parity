import { describe, expect, it } from 'vitest';
import {
  applyParagraphFormat,
  setAlignment,
  setLineSpacing,
  setSpaceBefore,
  setSpaceAfter,
  toggleBulletList,
  toggleNumberedList,
  indent,
  outdent,
  bulletLabel,
  toRoman,
  toAlpha,
  getBodyText,
} from '../../src/text';
import { defaultTextBody, paragraphOf } from '../../src/core/defaults';
import type { BulletNumbered } from '../../src/core/types';

function b(...texts: string[]) {
  return defaultTextBody({ paragraphs: texts.map((t) => paragraphOf(t)) });
}

const numbered = (
  format: BulletNumbered['format'],
  startAt = 1,
): BulletNumbered => ({ type: 'number', format, startAt });

describe('paragraph formatting', () => {
  it('applyParagraphFormat patches an inclusive range', () => {
    const body = b('a', 'b', 'c');
    applyParagraphFormat(body, 0, 1, { align: 'justify', spaceBefore: 4, indent: 10 });
    expect(body.paragraphs[0].align).toBe('justify');
    expect(body.paragraphs[1].align).toBe('justify');
    expect(body.paragraphs[2].align).toBe('left');
    expect(body.paragraphs[0].spaceBefore).toBe(4);
    expect(body.paragraphs[1].indent).toBe(10);
  });

  it('applyParagraphFormat ignores undefined values and never touches children', () => {
    const body = b('keep me');
    applyParagraphFormat(body, 0, 0, { align: undefined, lineSpacing: 1.5 });
    expect(body.paragraphs[0].align).toBe('left');
    expect(body.paragraphs[0].lineSpacing).toBe(1.5);
    expect(getBodyText(body)).toBe('keep me');
  });

  it('clamps out-of-range indices and accepts reversed order', () => {
    const body = b('a', 'b');
    applyParagraphFormat(body, 5, -3, { align: 'center' });
    expect(body.paragraphs.every((p) => p.align === 'center')).toBe(true);
  });

  it('setAlignment / setLineSpacing / setSpaceBefore / setSpaceAfter', () => {
    const body = b('one', 'two');
    setAlignment(body, 0, 1, 'right');
    setLineSpacing(body, 0, 0, 2);
    setSpaceBefore(body, 1, 1, 12);
    setSpaceAfter(body, 1, 1, 6);
    expect(body.paragraphs[0].align).toBe('right');
    expect(body.paragraphs[1].align).toBe('right');
    expect(body.paragraphs[0].lineSpacing).toBe(2);
    expect(body.paragraphs[1].lineSpacing).toBe(1);
    expect(body.paragraphs[1].spaceBefore).toBe(12);
    expect(body.paragraphs[1].spaceAfter).toBe(6);
  });
});

describe('bullet / numbered list toggles', () => {
  it('toggleBulletList applies the default bullet char to a mixed range', () => {
    const body = b('a', 'b');
    body.paragraphs[0].bullet = { type: 'char', char: '•' };
    toggleBulletList(body, 0, 1);
    expect(body.paragraphs[0].bullet).toEqual({ type: 'char', char: '•' });
    expect(body.paragraphs[1].bullet).toEqual({ type: 'char', char: '•' });
  });

  it('toggleBulletList removes bullets when every paragraph has one', () => {
    const body = b('a', 'b');
    toggleBulletList(body, 0, 1, '-');
    expect(body.paragraphs[0].bullet).toEqual({ type: 'char', char: '-' });
    toggleBulletList(body, 0, 1, '-');
    expect(body.paragraphs[0].bullet).toEqual({ type: 'none' });
    expect(body.paragraphs[1].bullet).toEqual({ type: 'none' });
  });

  it('toggleNumberedList applies and removes numbering for the same format', () => {
    const body = b('a', 'b');
    toggleNumberedList(body, 0, 1);
    expect(body.paragraphs[0].bullet).toEqual(numbered('arabicPeriod'));
    toggleNumberedList(body, 0, 1);
    expect(body.paragraphs[0].bullet).toEqual({ type: 'none' });
  });

  it('toggleNumberedList with a different format switches instead of removing', () => {
    const body = b('a');
    toggleNumberedList(body, 0, 0, 'arabicPeriod');
    toggleNumberedList(body, 0, 0, 'romanLcPeriod');
    expect(body.paragraphs[0].bullet).toEqual(numbered('romanLcPeriod'));
  });
});

describe('indent / outdent', () => {
  it('indent raises the level by one, clamped at 8', () => {
    const body = b('a', 'b');
    body.paragraphs[1].level = 8;
    indent(body, 0, 1);
    expect(body.paragraphs[0].level).toBe(1);
    expect(body.paragraphs[1].level).toBe(8);
  });

  it('outdent lowers the level by one, clamped at 0', () => {
    const body = b('a', 'b');
    body.paragraphs[0].level = 2;
    outdent(body, 0, 1);
    expect(body.paragraphs[0].level).toBe(1);
    expect(body.paragraphs[1].level).toBe(0);
  });
});

describe('roman numerals and alpha labels', () => {
  it('toRoman produces correct subtractive numerals', () => {
    expect(toRoman(1)).toBe('i');
    expect(toRoman(3)).toBe('iii');
    expect(toRoman(4)).toBe('iv');
    expect(toRoman(9)).toBe('ix');
    expect(toRoman(14)).toBe('xiv');
    expect(toRoman(40)).toBe('xl');
    expect(toRoman(49)).toBe('xlix');
    expect(toRoman(90)).toBe('xc');
    expect(toRoman(1994)).toBe('mcmxciv');
  });

  it('toAlpha covers a..z and bijective base-26 beyond', () => {
    expect(toAlpha(1)).toBe('a');
    expect(toAlpha(26)).toBe('z');
    expect(toAlpha(27)).toBe('aa');
    expect(toAlpha(28)).toBe('ab');
    expect(toAlpha(52)).toBe('az');
    expect(toAlpha(53)).toBe('ba');
    expect(toAlpha(703)).toBe('aaa');
  });
});

describe('bulletLabel', () => {
  it('renders all numbered formats in the model', () => {
    expect(bulletLabel(numbered('arabicPeriod'), 1)).toBe('1.');
    expect(bulletLabel(numbered('arabicParen'), 2)).toBe('2)');
    expect(bulletLabel(numbered('romanLcPeriod'), 4)).toBe('iv.');
    expect(bulletLabel(numbered('romanUcPeriod'), 9)).toBe('IX.');
    expect(bulletLabel(numbered('alphaLcPeriod'), 3)).toBe('c.');
    expect(bulletLabel(numbered('alphaUcPeriod'), 1)).toBe('A.');
    expect(bulletLabel(numbered('alphaLcParen'), 1)).toBe('(a)');
  });

  it('handles roman edge ordinals', () => {
    expect(bulletLabel(numbered('romanLcPeriod'), 14)).toBe('xiv.');
    expect(bulletLabel(numbered('romanLcPeriod'), 40)).toBe('xl.');
    expect(bulletLabel(numbered('romanUcPeriod'), 4)).toBe('IV.');
  });

  it('handles alpha ordinals beyond 26', () => {
    expect(bulletLabel(numbered('alphaLcPeriod'), 27)).toBe('aa.');
    expect(bulletLabel(numbered('alphaUcPeriod'), 27)).toBe('AA.');
    expect(bulletLabel(numbered('alphaLcParen'), 28)).toBe('(ab)');
  });

  it('honors startAt', () => {
    expect(bulletLabel(numbered('arabicPeriod', 5), 1)).toBe('5.');
    expect(bulletLabel(numbered('arabicPeriod', 5), 3)).toBe('7.');
    expect(bulletLabel(numbered('romanLcPeriod', 3), 2)).toBe('iv.');
  });
});
