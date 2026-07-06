import { describe, expect, it } from 'vitest';
import { dashArrayFor, gradientToCss, resolveFill, resolveLine } from '../../src/style';
import type { Fill, LineStyle } from '../../src/core/types';
import { defaultLine } from '../../src/core/defaults';
import { testScheme } from './fixtures';

describe('resolveFill', () => {
  it('resolves solid fills to css', () => {
    const fill: Fill = { type: 'solid', color: { type: 'theme', slot: 'accent1' } };
    expect(resolveFill(fill, testScheme)).toEqual({ type: 'solid', css: 'rgb(255, 0, 0)' });
  });

  it('resolves solid fills with tint and alpha', () => {
    const fill: Fill = {
      type: 'solid',
      color: { type: 'theme', slot: 'accent1', tint: 0.5, alpha: 0.4 },
    };
    expect(resolveFill(fill, testScheme)).toEqual({
      type: 'solid',
      css: 'rgba(255, 128, 128, 0.4)',
    });
  });

  it('resolves gradient fills, keeping kind/angle and resolving each stop', () => {
    const fill: Fill = {
      type: 'gradient',
      kind: 'linear',
      angle: 45,
      stops: [
        { position: 0, color: { type: 'theme', slot: 'accent1' } },
        { position: 1, color: { type: 'rgb', value: '0000FF', alpha: 0.5 } },
      ],
    };
    expect(resolveFill(fill, testScheme)).toEqual({
      type: 'gradient',
      kind: 'linear',
      angle: 45,
      stops: [
        { position: 0, css: 'rgb(255, 0, 0)' },
        { position: 1, css: 'rgba(0, 0, 255, 0.5)' },
      ],
    });
  });

  it('sorts gradient stops by position', () => {
    const fill: Fill = {
      type: 'gradient',
      kind: 'linear',
      angle: 0,
      stops: [
        { position: 1, color: { type: 'rgb', value: '000000' } },
        { position: 0, color: { type: 'rgb', value: 'FFFFFF' } },
      ],
    };
    const resolved = resolveFill(fill, testScheme);
    if (resolved.type !== 'gradient') throw new Error('expected gradient');
    expect(resolved.stops.map((s) => s.position)).toEqual([0, 1]);
  });

  it('passes picture fills through', () => {
    const fill: Fill = { type: 'picture', src: 'data:img', mode: 'tile' };
    expect(resolveFill(fill, testScheme)).toEqual({ type: 'picture', src: 'data:img', mode: 'tile' });
  });

  it('resolves pattern fill colors', () => {
    const fill: Fill = {
      type: 'pattern',
      pattern: 'diagonalUp',
      foreground: { type: 'theme', slot: 'accent2' },
      background: { type: 'theme', slot: 'light1' },
    };
    expect(resolveFill(fill, testScheme)).toEqual({
      type: 'pattern',
      pattern: 'diagonalUp',
      foregroundCss: 'rgb(0, 255, 0)',
      backgroundCss: 'rgb(255, 255, 255)',
    });
  });

  it('passes none through', () => {
    expect(resolveFill({ type: 'none' }, testScheme)).toEqual({ type: 'none' });
  });
});

describe('gradientToCss', () => {
  it('produces linear-gradient with the css angle offset by 90deg', () => {
    // model angle 0 = left-to-right = css 90deg
    expect(
      gradientToCss({
        type: 'gradient',
        kind: 'linear',
        angle: 0,
        stops: [
          { position: 0, css: 'rgb(255, 0, 0)' },
          { position: 1, css: 'rgb(0, 0, 255)' },
        ],
      }),
    ).toBe('linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)');
  });

  it('includes intermediate stop positions as percentages', () => {
    expect(
      gradientToCss({
        type: 'gradient',
        kind: 'linear',
        angle: 90,
        stops: [
          { position: 0, css: 'rgb(0, 0, 0)' },
          { position: 0.25, css: 'rgb(50, 50, 50)' },
          { position: 1, css: 'rgb(255, 255, 255)' },
        ],
      }),
    ).toBe(
      'linear-gradient(180deg, rgb(0, 0, 0) 0%, rgb(50, 50, 50) 25%, rgb(255, 255, 255) 100%)',
    );
  });

  it('produces radial-gradient for radial kind (ignoring angle)', () => {
    expect(
      gradientToCss({
        type: 'gradient',
        kind: 'radial',
        angle: 45,
        stops: [
          { position: 0, css: 'rgb(255, 255, 255)' },
          { position: 1, css: 'rgb(0, 0, 0)' },
        ],
      }),
    ).toBe('radial-gradient(circle, rgb(255, 255, 255) 0%, rgb(0, 0, 0) 100%)');
  });
});

describe('dashArrayFor', () => {
  it('returns undefined for solid lines', () => {
    expect(dashArrayFor('solid', 3)).toBeUndefined();
  });

  it('scales dash patterns by line width', () => {
    expect(dashArrayFor('dash', 1)).toEqual([4, 3]);
    expect(dashArrayFor('dash', 2)).toEqual([8, 6]);
    expect(dashArrayFor('dot', 1)).toEqual([1, 3]);
    expect(dashArrayFor('dot', 3)).toEqual([3, 9]);
    expect(dashArrayFor('dashDot', 2)).toEqual([8, 6, 2, 6]);
    expect(dashArrayFor('longDash', 1)).toEqual([8, 3]);
  });

  it('never scales below width 1', () => {
    expect(dashArrayFor('dash', 0.5)).toEqual([4, 3]);
    expect(dashArrayFor('dot', 0)).toEqual([1, 3]);
  });
});

describe('resolveLine', () => {
  it('resolves a solid line to css + width + dash array', () => {
    const line: LineStyle = {
      fill: { type: 'solid', color: { type: 'theme', slot: 'accent3' } },
      width: 2,
      dash: 'dash',
      cap: 'flat',
    };
    expect(resolveLine(line, testScheme)).toEqual({
      css: 'rgb(0, 0, 255)',
      width: 2,
      dashArray: [8, 6],
    });
  });

  it('resolves the default line (accent1 shade 0.25)', () => {
    // FF0000 shaded 25% -> 191,0,0
    expect(resolveLine(defaultLine(), testScheme)).toEqual({
      css: 'rgb(191, 0, 0)',
      width: 1,
      dashArray: undefined,
    });
  });

  it('maps a no-fill line to transparent', () => {
    const line: LineStyle = { fill: { type: 'none' }, width: 0, dash: 'solid', cap: 'flat' };
    const resolved = resolveLine(line, testScheme);
    expect(resolved.css).toBe('transparent');
    expect(resolved.width).toBe(0);
    expect(resolved.dashArray).toBeUndefined();
  });

  it('uses the first gradient stop for gradient line fills', () => {
    const line: LineStyle = {
      fill: {
        type: 'gradient',
        kind: 'linear',
        angle: 0,
        stops: [
          { position: 0, color: { type: 'theme', slot: 'accent2' } },
          { position: 1, color: { type: 'theme', slot: 'accent3' } },
        ],
      },
      width: 1,
      dash: 'dot',
      cap: 'round',
    };
    expect(resolveLine(line, testScheme)).toEqual({
      css: 'rgb(0, 255, 0)',
      width: 1,
      dashArray: [1, 3],
    });
  });

  it('uses the pattern foreground for pattern line fills', () => {
    const line: LineStyle = {
      fill: {
        type: 'pattern',
        pattern: 'cross',
        foreground: { type: 'rgb', value: '112233' },
        background: { type: 'rgb', value: 'FFFFFF' },
      },
      width: 4,
      dash: 'longDash',
      cap: 'square',
    };
    expect(resolveLine(line, testScheme)).toEqual({
      css: 'rgb(17, 34, 51)',
      width: 4,
      dashArray: [32, 12],
    });
  });
});
