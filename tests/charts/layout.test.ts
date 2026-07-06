import { describe, expect, it } from 'vitest';
import { createChart, setChartData, computeChartLayout } from '../../src/charts';
import type { Rect } from '../../src/core/types';

const PLOT: Rect = { x: 0, y: 0, width: 100, height: 100 };

describe('column / bar layout', () => {
  it('places grouped columns side by side with a 20% category gap', () => {
    const c = createChart('column');
    setChartData(
      c,
      ['A', 'B'],
      [
        { name: 'S1', values: [10, 20] },
        { name: 'S2', values: [30, 40] },
      ],
    );
    const layout = computeChartLayout(c, PLOT);
    expect(layout.kind).toBe('bars');
    if (layout.kind !== 'bars') return;
    expect(layout.bars).toHaveLength(4);
    // axis is 0..40, slot 50, gap 10 (5 each side), bar width 20
    const find = (s: number, cat: number) =>
      layout.bars.find((b) => b.seriesIndex === s && b.categoryIndex === cat)!;
    expect(find(0, 0).rect).toEqual({ x: 5, y: 75, width: 20, height: 25 });
    expect(find(1, 0).rect).toEqual({ x: 25, y: 25, width: 20, height: 75 });
    expect(find(0, 1).rect).toEqual({ x: 55, y: 50, width: 20, height: 50 });
    expect(find(1, 1).rect).toEqual({ x: 75, y: 0, width: 20, height: 100 });
    expect(find(1, 1).value).toBe(40);
  });

  it('draws negative columns below the zero line', () => {
    const c = createChart('column');
    setChartData(c, ['A', 'B'], [{ name: 'S', values: [10, -20] }]);
    const layout = computeChartLayout(c, { x: 0, y: 0, width: 100, height: 90 });
    expect(layout.kind).toBe('bars');
    if (layout.kind !== 'bars') return;
    // axis -20..10 -> zero line at y=30
    expect(layout.bars[0].rect).toEqual({ x: 5, y: 0, width: 40, height: 30 }); // up from zero
    expect(layout.bars[1].rect).toEqual({ x: 55, y: 30, width: 40, height: 60 }); // down from zero
  });

  it("'bar' is the horizontal variant growing from the zero line", () => {
    const c = createChart('bar');
    setChartData(c, ['A', 'B'], [{ name: 'S', values: [-5, 5] }]);
    const layout = computeChartLayout(c, PLOT);
    expect(layout.kind).toBe('bars');
    if (layout.kind !== 'bars') return;
    // axis -5..5 -> zero line at x=50; slot 50, thickness 40
    expect(layout.bars[0].rect).toEqual({ x: 0, y: 5, width: 50, height: 40 });
    expect(layout.bars[1].rect).toEqual({ x: 50, y: 55, width: 50, height: 40 });
  });
});

describe('line / area layout', () => {
  it('maps one polyline per series at category centers', () => {
    const c = createChart('line');
    setChartData(
      c,
      ['A', 'B', 'C'],
      [
        { name: 'S1', values: [0, 5, 10] },
        { name: 'S2', values: [10, 10, 10] },
      ],
    );
    const layout = computeChartLayout(c, { x: 0, y: 0, width: 90, height: 100 });
    expect(layout.kind).toBe('lines');
    if (layout.kind !== 'lines') return;
    expect(layout.lines).toHaveLength(2);
    // axis 0..10 -> y = 100 - 10v; centers at x = 15, 45, 75
    expect(layout.lines[0].points).toEqual([
      { x: 15, y: 100 },
      { x: 45, y: 50 },
      { x: 75, y: 0 },
    ]);
    expect(layout.lines[1].points.map((p) => p.y)).toEqual([0, 0, 0]);
    expect(layout.lines[1].seriesIndex).toBe(1);
  });

  it('area charts use the same polyline layout', () => {
    const c = createChart('area');
    setChartData(c, ['A'], [{ name: 'S', values: [10] }]);
    const layout = computeChartLayout(c, { x: 0, y: 0, width: 90, height: 100 });
    expect(layout.kind).toBe('lines');
  });
});

describe('pie / doughnut layout', () => {
  it('starts at -90 degrees, sweeps clockwise, and sums to 360', () => {
    const c = createChart('pie');
    setChartData(c, ['A', 'B', 'C'], [{ name: 'S', values: [1, 1, 2] }]);
    const layout = computeChartLayout(c, PLOT);
    expect(layout.kind).toBe('pie');
    if (layout.kind !== 'pie') return;
    expect(layout.innerRadiusRatio).toBe(0);
    expect(layout.slices).toHaveLength(3);
    expect(layout.slices[0]).toMatchObject({ startAngle: -90, endAngle: 0, percent: 25 });
    expect(layout.slices[1]).toMatchObject({ startAngle: 0, endAngle: 90, percent: 25 });
    expect(layout.slices[2]).toMatchObject({ startAngle: 90, endAngle: 270, percent: 50 });
    const sweep = layout.slices.reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    expect(sweep).toBeCloseTo(360, 9);
    expect(layout.slices.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(100, 9);
  });

  it('ignores negative values but keeps their (empty) slice', () => {
    const c = createChart('pie');
    setChartData(c, ['A', 'B', 'C'], [{ name: 'S', values: [3, -3, 1] }]);
    const layout = computeChartLayout(c, PLOT);
    if (layout.kind !== 'pie') throw new Error('expected pie layout');
    expect(layout.slices[0]).toMatchObject({ startAngle: -90, endAngle: 180, percent: 75 });
    expect(layout.slices[1]).toMatchObject({ startAngle: 180, endAngle: 180, value: 0, percent: 0 });
    expect(layout.slices[2]).toMatchObject({ startAngle: 180, endAngle: 270 });
  });

  it('doughnut layout carries innerRadiusRatio 0.55', () => {
    const c = createChart('doughnut');
    const layout = computeChartLayout(c, PLOT);
    if (layout.kind !== 'pie') throw new Error('expected pie layout');
    expect(layout.innerRadiusRatio).toBe(0.55);
  });
});

describe('scatter layout', () => {
  it('parses numeric categories as x values', () => {
    const c = createChart('scatter');
    setChartData(c, ['0', '5', '10'], [{ name: 'S', values: [0, 5, 10] }]);
    const layout = computeChartLayout(c, PLOT);
    expect(layout.kind).toBe('scatter');
    if (layout.kind !== 'scatter') return;
    expect(layout.series[0].points).toEqual([
      { x: 0, y: 100 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
  });

  it('falls back to the category index for non-numeric categories', () => {
    const c = createChart('scatter');
    setChartData(c, ['a', 'b', 'c'], [{ name: 'S', values: [0, 1, 2] }]);
    const layout = computeChartLayout(c, PLOT);
    if (layout.kind !== 'scatter') throw new Error('expected scatter layout');
    // x data becomes 0,1,2 -> mapped across the plot width
    expect(layout.series[0].points.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(layout.series[0].points.map((p) => p.y)).toEqual([100, 50, 0]);
  });

  it('mixes parsed and fallback x values, and indexes past the categories', () => {
    const c = createChart('scatter');
    setChartData(c, ['1', 'x', '3'], [{ name: 'S', values: [1, 1, 1, 1] }]);
    const layout = computeChartLayout(c, PLOT);
    if (layout.kind !== 'scatter') throw new Error('expected scatter layout');
    // xs = [1, 1 (fallback index), 3, 3 (index past categories)]
    const xs = layout.series[0].points.map((p) => p.x);
    expect(xs[0]).toBe(xs[1]); // 'x' fell back to index 1 === parsed '1'
    expect(xs[2]).toBe(xs[3]);
    expect(xs[3]).toBeGreaterThan(xs[0]);
  });
});
