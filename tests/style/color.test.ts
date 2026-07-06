import { describe, expect, it } from 'vitest';
import {
  applyShade,
  applyTint,
  colorToCss,
  contrastRatio,
  contrastingTextColor,
  luminance,
  mixColors,
  parseHex,
  resolveColor,
  resolveColorToCss,
  toHex,
} from '../../src/style';
import { testScheme } from './fixtures';

describe('parseHex / toHex', () => {
  it('parses a 6-digit hex string', () => {
    expect(parseHex('1A2B3C')).toEqual({ r: 26, g: 43, b: 60 });
  });

  it('accepts a leading # and lowercase digits', () => {
    expect(parseHex('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
  });

  it('expands 3-digit shorthand', () => {
    expect(parseHex('abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('throws on invalid input', () => {
    expect(() => parseHex('nothex')).toThrow();
    expect(() => parseHex('12345')).toThrow();
    expect(() => parseHex('')).toThrow();
  });

  it('round-trips through toHex', () => {
    expect(toHex({ r: 26, g: 43, b: 60 })).toBe('1A2B3C');
    expect(toHex(parseHex('954F72'))).toBe('954F72');
  });

  it('toHex clamps and pads channels', () => {
    expect(toHex({ r: -5, g: 300, b: 7 })).toBe('00FF07');
  });
});

describe('applyTint / applyShade', () => {
  it('tint 0 leaves the color unchanged', () => {
    expect(applyTint({ r: 40, g: 80, b: 120 }, 0)).toEqual({ r: 40, g: 80, b: 120 });
  });

  it('tint 1 produces white', () => {
    expect(applyTint({ r: 40, g: 80, b: 120 }, 1)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('tint 0.5 moves halfway toward white', () => {
    // c + (255 - c) * 0.5
    expect(applyTint({ r: 0, g: 100, b: 255 }, 0.5)).toEqual({ r: 128, g: 178, b: 255 });
  });

  it('tint 0.2 exact values', () => {
    // 50 + 205*0.2 = 91, 100 + 155*0.2 = 131, 200 + 55*0.2 = 211
    expect(applyTint({ r: 50, g: 100, b: 200 }, 0.2)).toEqual({ r: 91, g: 131, b: 211 });
  });

  it('shade 0 leaves the color unchanged', () => {
    expect(applyShade({ r: 40, g: 80, b: 120 }, 0)).toEqual({ r: 40, g: 80, b: 120 });
  });

  it('shade 1 produces black', () => {
    expect(applyShade({ r: 40, g: 80, b: 120 }, 1)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('shade 0.5 halves each channel', () => {
    expect(applyShade({ r: 200, g: 100, b: 50 }, 0.5)).toEqual({ r: 100, g: 50, b: 25 });
  });

  it('shade 0.25 exact values', () => {
    // 200*0.75 = 150, 100*0.75 = 75, 40*0.75 = 30
    expect(applyShade({ r: 200, g: 100, b: 40 }, 0.25)).toEqual({ r: 150, g: 75, b: 30 });
  });
});

describe('resolveColor', () => {
  it('passes rgb colors through with default alpha 1', () => {
    expect(resolveColor({ type: 'rgb', value: '1A2B3C' }, testScheme)).toEqual({
      r: 26,
      g: 43,
      b: 60,
      a: 1,
    });
  });

  it('passes rgb alpha through', () => {
    expect(resolveColor({ type: 'rgb', value: 'FF0000', alpha: 0.25 }, testScheme)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 0.25,
    });
  });

  it('looks up theme slots', () => {
    expect(resolveColor({ type: 'theme', slot: 'accent2' }, testScheme)).toEqual({
      r: 0,
      g: 255,
      b: 0,
      a: 1,
    });
    expect(resolveColor({ type: 'theme', slot: 'dark2' }, testScheme)).toEqual({
      r: 68,
      g: 68,
      b: 68,
      a: 1,
    });
  });

  it('applies tint to theme colors', () => {
    expect(resolveColor({ type: 'theme', slot: 'accent1', tint: 0.5 }, testScheme)).toEqual({
      r: 255,
      g: 128,
      b: 128,
      a: 1,
    });
  });

  it('applies shade to theme colors', () => {
    expect(resolveColor({ type: 'theme', slot: 'accent1', shade: 0.5 }, testScheme)).toEqual({
      r: 128,
      g: 0,
      b: 0,
      a: 1,
    });
  });

  it('applies tint then shade then alpha, in that order', () => {
    // FF0000 -> tint 0.5 -> (255,128,128) -> shade 0.5 -> (128,64,64)
    expect(
      resolveColor({ type: 'theme', slot: 'accent1', tint: 0.5, shade: 0.5, alpha: 0.7 }, testScheme),
    ).toEqual({ r: 128, g: 64, b: 64, a: 0.7 });
  });
});

describe('colorToCss', () => {
  it('emits rgb() for opaque colors', () => {
    expect(colorToCss({ r: 1, g: 2, b: 3, a: 1 })).toBe('rgb(1, 2, 3)');
  });

  it('emits rgba() when alpha < 1', () => {
    expect(colorToCss({ r: 255, g: 0, b: 128, a: 0.5 })).toBe('rgba(255, 0, 128, 0.5)');
    expect(colorToCss({ r: 0, g: 0, b: 0, a: 0 })).toBe('rgba(0, 0, 0, 0)');
  });

  it('rounds fractional channels', () => {
    expect(colorToCss({ r: 12.4, g: 200.6, b: 99.5, a: 1 })).toBe('rgb(12, 201, 100)');
  });

  it('resolveColorToCss resolves theme colors end-to-end', () => {
    expect(resolveColorToCss({ type: 'theme', slot: 'accent3', alpha: 0.5 }, testScheme)).toBe(
      'rgba(0, 0, 255, 0.5)',
    );
    expect(resolveColorToCss({ type: 'rgb', value: '1A2B3C' }, testScheme)).toBe(
      'rgb(26, 43, 60)',
    );
  });
});

describe('luminance / contrast', () => {
  it('white has luminance 1 and black 0', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  it('pure green is brighter than pure red, which is brighter than pure blue', () => {
    const red = luminance({ r: 255, g: 0, b: 0 });
    const green = luminance({ r: 0, g: 255, b: 0 });
    const blue = luminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
    expect(red).toBeCloseTo(0.2126, 4);
  });

  it('contrast ratio of black on white is 21', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 3);
    expect(contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 })).toBeCloseTo(1, 5);
  });

  it('chooses black text on white and light backgrounds', () => {
    expect(contrastingTextColor({ r: 255, g: 255, b: 255 })).toBe('#000000');
    expect(contrastingTextColor({ r: 255, g: 255, b: 0 })).toBe('#000000');
    expect(contrastingTextColor({ r: 128, g: 128, b: 128 })).toBe('#000000');
  });

  it('chooses white text on black and dark backgrounds', () => {
    expect(contrastingTextColor({ r: 0, g: 0, b: 0 })).toBe('#FFFFFF');
    expect(contrastingTextColor({ r: 60, g: 60, b: 60 })).toBe('#FFFFFF');
    expect(contrastingTextColor({ r: 0, g: 0, b: 255 })).toBe('#FFFFFF');
  });
});

describe('mixColors', () => {
  it('t=0 returns the first color, t=1 the second', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 100, b: 0 };
    expect(mixColors(a, b, 0)).toEqual(a);
    expect(mixColors(a, b, 1)).toEqual(b);
  });

  it('t=0.5 averages the channels', () => {
    expect(mixColors({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5)).toEqual({
      r: 128,
      g: 128,
      b: 128,
    });
    expect(mixColors({ r: 100, g: 0, b: 50 }, { r: 200, g: 100, b: 150 }, 0.5)).toEqual({
      r: 150,
      g: 50,
      b: 100,
    });
  });

  it('t=0.25 interpolates linearly', () => {
    expect(mixColors({ r: 0, g: 100, b: 200 }, { r: 100, g: 200, b: 100 }, 0.25)).toEqual({
      r: 25,
      g: 125,
      b: 175,
    });
  });
});
