import { describe, expect, it } from 'vitest';
import {
  createChart,
  setChartData,
  addSeries,
  removeSeries,
  renameSeries,
  setChartKind,
  toggleLegend,
  setTitle,
  legendEntries,
  defaultSeriesColorSlot,
} from '../../src/charts';

describe('createChart', () => {
  it('creates a chart with sample data (3 categories, 2 series)', () => {
    const c = createChart('column');
    expect(c.type).toBe('chart');
    expect(c.chartKind).toBe('column');
    expect(c.categories).toHaveLength(3);
    expect(c.series).toHaveLength(2);
    expect(c.series[0].values).toHaveLength(3);
    expect(c.series[1].values).toHaveLength(3);
    expect(c.showLegend).toBe(true);
  });

  it('applies transform overrides', () => {
    const c = createChart('pie', { x: 1, y: 2, width: 300, height: 200 });
    expect(c.transform).toMatchObject({ x: 1, y: 2, width: 300, height: 200 });
  });
});

describe('data operations', () => {
  it('setChartData replaces categories and series', () => {
    const c = createChart('column');
    setChartData(c, ['A', 'B'], [{ name: 'S', values: [1, 2] }]);
    expect(c.categories).toEqual(['A', 'B']);
    expect(c.series).toEqual([{ name: 'S', values: [1, 2] }]);
  });

  it('setChartData rejects mismatched value counts', () => {
    const c = createChart('line');
    expect(() => setChartData(c, ['A', 'B', 'C'], [{ name: 'S', values: [1, 2] }])).toThrow(
      /2 values.*3 categories/,
    );
  });

  it('scatter charts are exempt from the length validation', () => {
    const c = createChart('scatter');
    expect(() =>
      setChartData(c, ['1', '2', '3'], [{ name: 'S', values: [1, 2, 3, 4, 5] }]),
    ).not.toThrow();
    expect(c.series[0].values).toHaveLength(5);
  });

  it('setChartData copies its inputs (no aliasing)', () => {
    const c = createChart('column');
    const values = [1, 2, 3];
    setChartData(c, ['A', 'B', 'C'], [{ name: 'S', values }]);
    values[0] = 99;
    expect(c.series[0].values[0]).toBe(1);
  });

  it('addSeries defaults to zeros and auto-names', () => {
    const c = createChart('column');
    const s = addSeries(c);
    expect(c.series).toHaveLength(3);
    expect(s.name).toBe('Series 3');
    expect(s.values).toEqual([0, 0, 0]);
  });

  it('addSeries validates explicit values', () => {
    const c = createChart('column');
    expect(() => addSeries(c, 'Bad', [1])).toThrow(/1 values.*3 categories/);
    expect(c.series).toHaveLength(2); // nothing appended on failure
    addSeries(c, 'Good', [7, 8, 9]);
    expect(c.series[2].values).toEqual([7, 8, 9]);
  });

  it('removeSeries and renameSeries validate indices', () => {
    const c = createChart('column');
    removeSeries(c, 0);
    expect(c.series.map((s) => s.name)).toEqual(['Series 2']);
    renameSeries(c, 0, 'Revenue');
    expect(c.series[0].name).toBe('Revenue');
    expect(() => removeSeries(c, 5)).toThrow(RangeError);
    expect(() => renameSeries(c, -1, 'x')).toThrow(RangeError);
  });

  it('setChartKind to pie keeps only the first series and warns', () => {
    const c = createChart('column');
    const result = setChartKind(c, 'pie');
    expect(c.chartKind).toBe('pie');
    expect(c.series).toHaveLength(1);
    expect(c.series[0].name).toBe('Series 1');
    expect(result.warning).toMatch(/1 additional series removed/);
  });

  it('setChartKind without data loss returns no warning', () => {
    const c = createChart('column');
    expect(setChartKind(c, 'line').warning).toBeUndefined();
    expect(c.chartKind).toBe('line');
    removeSeries(c, 1);
    expect(setChartKind(c, 'doughnut').warning).toBeUndefined();
  });

  it('toggleLegend flips and reports state; setTitle sets the title', () => {
    const c = createChart('bar');
    expect(toggleLegend(c)).toBe(false);
    expect(c.showLegend).toBe(false);
    expect(toggleLegend(c)).toBe(true);
    setTitle(c, 'Sales by Region');
    expect(c.title).toBe('Sales by Region');
  });
});

describe('legend and colors', () => {
  it('legendEntries lists series for cartesian charts', () => {
    const c = createChart('column');
    expect(legendEntries(c)).toEqual([
      { label: 'Series 1', colorIndex: 0 },
      { label: 'Series 2', colorIndex: 1 },
    ]);
  });

  it('legendEntries lists categories for pie/doughnut', () => {
    const c = createChart('pie');
    expect(legendEntries(c)).toEqual([
      { label: 'Category 1', colorIndex: 0 },
      { label: 'Category 2', colorIndex: 1 },
      { label: 'Category 3', colorIndex: 2 },
    ]);
  });

  it('defaultSeriesColorSlot cycles accent1..accent6', () => {
    expect(defaultSeriesColorSlot(0)).toBe('accent1');
    expect(defaultSeriesColorSlot(5)).toBe('accent6');
    expect(defaultSeriesColorSlot(6)).toBe('accent1');
    expect(defaultSeriesColorSlot(8)).toBe('accent3');
  });
});
