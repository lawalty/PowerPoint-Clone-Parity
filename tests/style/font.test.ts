import { describe, expect, it } from 'vitest';
import { resolveFont, resolveFontFamily } from '../../src/style';
import { defaultFont } from '../../src/core/defaults';
import { testTheme } from './fixtures';

describe('resolveFontFamily', () => {
  const fonts = testTheme.fontScheme;

  it('maps major to the heading font', () => {
    expect(resolveFontFamily('major', fonts)).toBe('Heading Font');
  });

  it('maps minor to the body font', () => {
    expect(resolveFontFamily('minor', fonts)).toBe('Body Font');
  });

  it('passes concrete family names through', () => {
    expect(resolveFontFamily('Georgia', fonts)).toBe('Georgia');
    expect(resolveFontFamily('Comic Sans MS', fonts)).toBe('Comic Sans MS');
  });
});

describe('resolveFont', () => {
  it('resolves theme family and theme color to concrete values', () => {
    const font = defaultFont({
      family: 'major',
      size: 32,
      bold: true,
      color: { type: 'theme', slot: 'accent1', shade: 0.5 },
    });
    const resolved = resolveFont(font, testTheme);
    expect(resolved.family).toBe('Heading Font');
    expect(resolved.size).toBe(32);
    expect(resolved.bold).toBe(true);
    expect(resolved.italic).toBe(false);
    expect(resolved.color).toBe('rgb(128, 0, 0)');
    expect(resolved.highlight).toBeUndefined();
  });

  it('keeps minor family + carries all flat properties', () => {
    const font = defaultFont({
      italic: true,
      underline: true,
      strikethrough: true,
      baseline: 'superscript',
      letterSpacing: 1.5,
      capitalization: 'smallCaps',
      color: { type: 'rgb', value: '1A2B3C', alpha: 0.5 },
    });
    const resolved = resolveFont(font, testTheme);
    expect(resolved.family).toBe('Body Font');
    expect(resolved.italic).toBe(true);
    expect(resolved.underline).toBe(true);
    expect(resolved.strikethrough).toBe(true);
    expect(resolved.baseline).toBe('superscript');
    expect(resolved.letterSpacing).toBe(1.5);
    expect(resolved.capitalization).toBe('smallCaps');
    expect(resolved.color).toBe('rgba(26, 43, 60, 0.5)');
  });

  it('resolves the highlight color when present', () => {
    const font = defaultFont({ highlight: { type: 'theme', slot: 'accent4' } });
    expect(resolveFont(font, testTheme).highlight).toBe('rgb(255, 255, 0)');
  });
});
