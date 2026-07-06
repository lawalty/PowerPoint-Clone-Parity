import { describe, expect, it } from 'vitest';
import { createChart, setChartData, niceAxis, valueRange } from '../../src/charts';

describe('niceAxis', () => {
  it('0..97 -> step 10, max 100', () => {
    const a = niceAxis(0, 97);
    expect(a.min).toBe(0);
    expect(a.max).toBe(100);
    expect(a.step).toBe(10);
    expect(a.ticks).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('-35..80 -> step 20, min -40, max 80', () => {
    const a = niceAxis(-35, 80);
    expect(a).toEqual({
      min: -40,
      max: 80,
      step: 20,
      ticks: [-40, -20, 0, 20, 40, 60, 80],
    });
  });

  it('degenerate 5..5 expands to a 0..5 axis with step 0.5', () => {
    const a = niceAxis(5, 5);
    expect(a.min).toBe(0);
    expect(a.max).toBe(5);
    expect(a.step).toBe(0.5);
    expect(a.ticks).toHaveLength(11);
    expect(a.ticks[1]).toBe(0.5); // no float noise
  });

  it('all-zero data yields a 0..1 axis', () => {
    const a = niceAxis(0, 0);
    expect(a).toMatchObject({ min: 0, max: 1, step: 0.1 });
    expect(a.ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it('degenerate negative value expands toward zero', () => {
    const a = niceAxis(-5, -5);
    expect(a.min).toBe(-5);
    expect(a.max).toBe(0);
    expect(a.step).toBe(0.5);
  });

  it('handles reversed bounds', () => {
    expect(niceAxis(97, 0)).toEqual(niceAxis(0, 97));
  });

  it('respects maxTicks', () => {
    const a = niceAxis(0, 100, 5);
    expect(a.step).toBe(20);
    expect(a.ticks).toEqual([0, 20, 40, 60, 80, 100]);
    expect(a.ticks.length).toBeLessThanOrEqual(6);
  });

  it('rejects non-finite bounds', () => {
    expect(() => niceAxis(0, Infinity)).toThrow(RangeError);
    expect(() => niceAxis(NaN, 10)).toThrow(RangeError);
  });
});

describe('valueRange', () => {
  it('spans all series and includes the 0 baseline for column charts', () => {
    const c = createChart('column');
    setChartData(
      c,
      ['A', 'B'],
      [
        { name: 'S1', values: [5, 12] },
        { name: 'S2', values: [8, 3] },
      ],
    );
    expect(valueRange(c)).toEqual({ min: 0, max: 12 });
  });

  it('includes 0 for bar/line/area with all-negative data', () => {
    for (const kind of ['bar', 'line', 'area'] as const) {
      const c = createChart(kind);
      setChartData(c, ['A', 'B'], [{ name: 'S', values: [-4, -9] }]);
      expect(valueRange(c)).toEqual({ min: -9, max: 0 });
    }
  });

  it('does not force 0 for scatter', () => {
    const c = createChart('scatter');
    setChartData(c, ['1', '2'], [{ name: 'S', values: [5, 10] }]);
    expect(valueRange(c)).toEqual({ min: 5, max: 10 });
  });

  it('returns 0..0 for a chart with no series', () => {
    const c = createChart('column');
    c.series = [];
    expect(valueRange(c)).toEqual({ min: 0, max: 0 });
  });
});
