/**
 * Charts engine: chart creation, data operations, axis math and pure layout
 * computation for {@link ChartElement}. Data operations mutate the chart in
 * place; layout functions are pure and return plain data for a renderer.
 */

import type {
  ChartElement,
  ChartKind,
  ChartSeries,
  Point,
  Rect,
  ThemeColorSlot,
  Transform,
} from '../core/types';
import { defaultTransform } from '../core/defaults';
import { genId, round } from '../core/util';

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/** Create a chart of `kind` pre-filled with sample data (3 categories, 2 series). */
export function createChart(kind: ChartKind, transform: Partial<Transform> = {}): ChartElement {
  return {
    id: genId('chart'),
    type: 'chart',
    name: 'Chart',
    transform: defaultTransform({ x: 240, y: 120, width: 480, height: 300, ...transform }),
    hidden: false,
    locked: false,
    chartKind: kind,
    categories: ['Category 1', 'Category 2', 'Category 3'],
    series: [
      { name: 'Series 1', values: [4.3, 2.5, 3.5] },
      { name: 'Series 2', values: [2.4, 4.4, 1.8] },
    ],
    title: 'Chart Title',
    showLegend: true,
    legendPosition: 'bottom',
    showDataLabels: false,
  };
}

// ---------------------------------------------------------------------------
// Data operations
// ---------------------------------------------------------------------------

function assertSeriesLengths(
  kind: ChartKind,
  categories: string[],
  series: ChartSeries[],
): void {
  if (kind === 'scatter') return; // scatter x comes from numeric categories; lengths may differ
  for (const s of series) {
    if (s.values.length !== categories.length) {
      throw new Error(
        `series "${s.name}" has ${s.values.length} values but the chart has ${categories.length} categories`,
      );
    }
  }
}

/** Replace categories and series wholesale (validates value counts). */
export function setChartData(
  chart: ChartElement,
  categories: string[],
  series: ChartSeries[],
): void {
  assertSeriesLengths(chart.chartKind, categories, series);
  chart.categories = [...categories];
  chart.series = series.map((s) => ({ ...s, values: [...s.values] }));
}

/** Append a series (defaults to zeros). Returns the new series. */
export function addSeries(chart: ChartElement, name?: string, values?: number[]): ChartSeries {
  const series: ChartSeries = {
    name: name ?? `Series ${chart.series.length + 1}`,
    values: values ? [...values] : chart.categories.map(() => 0),
  };
  assertSeriesLengths(chart.chartKind, chart.categories, [series]);
  chart.series.push(series);
  return series;
}

export function removeSeries(chart: ChartElement, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= chart.series.length) {
    throw new RangeError(`series index ${index} out of range 0..${chart.series.length - 1}`);
  }
  chart.series.splice(index, 1);
}

export function renameSeries(chart: ChartElement, index: number, name: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= chart.series.length) {
    throw new RangeError(`series index ${index} out of range 0..${chart.series.length - 1}`);
  }
  chart.series[index].name = name;
}

export interface SetChartKindResult {
  /** Present when the kind change dropped data (pie/doughnut keep 1 series). */
  warning?: string;
}

/** Change the chart kind. Pie/doughnut keep only the first series. */
export function setChartKind(chart: ChartElement, kind: ChartKind): SetChartKindResult {
  chart.chartKind = kind;
  if ((kind === 'pie' || kind === 'doughnut') && chart.series.length > 1) {
    const dropped = chart.series.length - 1;
    chart.series = chart.series.slice(0, 1);
    return {
      warning: `${kind} charts show a single series; ${dropped} additional series removed`,
    };
  }
  return {};
}

/** Flip legend visibility; returns the new state. */
export function toggleLegend(chart: ChartElement): boolean {
  chart.showLegend = !chart.showLegend;
  return chart.showLegend;
}

export function setTitle(chart: ChartElement, title: string): void {
  chart.title = title;
}

// ---------------------------------------------------------------------------
// Axis math
// ---------------------------------------------------------------------------

export interface NiceAxis {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Heckbert "nice numbers": round `range` to 1/2/5 * 10^n. */
function niceNum(range: number, roundIt: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const f = range / 10 ** exp;
  let nf: number;
  if (roundIt) {
    nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  } else {
    nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  }
  return nf * 10 ** exp;
}

/**
 * Compute a "nice" axis covering [min, max] with at most ~maxTicks labels,
 * using 1/2/5 * 10^n steps. Handles reversed input, min === max, and all-zero
 * data (0..0 becomes 0..1).
 */
export function niceAxis(min: number, max: number, maxTicks = 10): NiceAxis {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError(`niceAxis requires finite bounds, got ${min}..${max}`);
  }
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    if (min === 0) max = 1;
    else if (min > 0) min = 0;
    else max = 0;
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / (Math.max(2, maxTicks) - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  const count = Math.round((niceMax - niceMin) / step);
  for (let i = 0; i <= count; i++) ticks.push(round(niceMin + i * step, 10));
  return { min: round(niceMin, 10), max: round(niceMax, 10), step: round(step, 10), ticks };
}

/**
 * Min/max across all series values. Bar/column/area/line charts always
 * include the 0 baseline. An empty chart yields {min: 0, max: 0}.
 */
export function valueRange(chart: ChartElement): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const s of chart.series) {
    for (const v of s.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (min === Infinity) return { min: 0, max: 0 };
  if (
    chart.chartKind === 'bar' ||
    chart.chartKind === 'column' ||
    chart.chartKind === 'area' ||
    chart.chartKind === 'line'
  ) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

export interface BarLayoutItem {
  seriesIndex: number;
  categoryIndex: number;
  rect: Rect;
  value: number;
}

export interface SeriesPolyline {
  seriesIndex: number;
  points: Point[];
}

export interface PieSlice {
  categoryIndex: number;
  /** Degrees; -90 is 12 o'clock, angles increase clockwise. */
  startAngle: number;
  endAngle: number;
  value: number;
  percent: number;
}

export type ChartLayout =
  | { kind: 'bars'; bars: BarLayoutItem[] }
  | { kind: 'lines'; lines: SeriesPolyline[] }
  | { kind: 'pie'; slices: PieSlice[]; innerRadiusRatio: number }
  | { kind: 'scatter'; series: SeriesPolyline[] };

/** Fraction of each category slot left as gap (split evenly on both sides). */
const CATEGORY_GAP = 0.2;

function scale(v: number, dMin: number, dMax: number, rMin: number, rMax: number): number {
  if (dMax === dMin) return (rMin + rMax) / 2;
  return rMin + ((v - dMin) / (dMax - dMin)) * (rMax - rMin);
}

function barLayout(chart: ChartElement, plotRect: Rect): ChartLayout {
  const vr = valueRange(chart);
  const axis = niceAxis(vr.min, vr.max);
  const nCats = Math.max(1, chart.categories.length);
  const nSeries = Math.max(1, chart.series.length);
  const horizontal = chart.chartKind === 'bar';
  const slot = (horizontal ? plotRect.height : plotRect.width) / nCats;
  const barThickness = (slot * (1 - CATEGORY_GAP)) / nSeries;
  const bars: BarLayoutItem[] = [];

  const toX = (v: number): number =>
    scale(v, axis.min, axis.max, plotRect.x, plotRect.x + plotRect.width);
  const toY = (v: number): number =>
    scale(v, axis.min, axis.max, plotRect.y + plotRect.height, plotRect.y);

  chart.series.forEach((s, si) => {
    for (let ci = 0; ci < chart.categories.length; ci++) {
      const value = s.values[ci] ?? 0;
      const crossStart =
        (horizontal ? plotRect.y : plotRect.x) +
        ci * slot +
        (slot * CATEGORY_GAP) / 2 +
        si * barThickness;
      if (horizontal) {
        const xv = toX(value);
        const zeroX = toX(0);
        bars.push({
          seriesIndex: si,
          categoryIndex: ci,
          value,
          rect: {
            x: Math.min(xv, zeroX),
            y: crossStart,
            width: Math.abs(xv - zeroX),
            height: barThickness,
          },
        });
      } else {
        const yv = toY(value);
        const zeroY = toY(0);
        bars.push({
          seriesIndex: si,
          categoryIndex: ci,
          value,
          rect: {
            x: crossStart,
            y: Math.min(yv, zeroY),
            width: barThickness,
            height: Math.abs(yv - zeroY),
          },
        });
      }
    }
  });
  return { kind: 'bars', bars };
}

function lineLayout(chart: ChartElement, plotRect: Rect): ChartLayout {
  const vr = valueRange(chart);
  const axis = niceAxis(vr.min, vr.max);
  const nCats = Math.max(1, chart.categories.length);
  const slot = plotRect.width / nCats;
  const lines: SeriesPolyline[] = chart.series.map((s, si) => ({
    seriesIndex: si,
    points: s.values.map((v, ci) => ({
      x: plotRect.x + (ci + 0.5) * slot,
      y: scale(v, axis.min, axis.max, plotRect.y + plotRect.height, plotRect.y),
    })),
  }));
  return { kind: 'lines', lines };
}

function pieLayout(chart: ChartElement): ChartLayout {
  const values = chart.categories.map((_, i) => {
    const v = chart.series[0]?.values[i] ?? 0;
    return v > 0 ? v : 0; // negative values are ignored
  });
  const total = values.reduce((sum, v) => sum + v, 0);
  let angle = -90; // 12 o'clock, sweeping clockwise
  const slices: PieSlice[] = values.map((value, categoryIndex) => {
    const sweep = total > 0 ? (value / total) * 360 : 0;
    const slice: PieSlice = {
      categoryIndex,
      startAngle: angle,
      endAngle: angle + sweep,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    };
    angle += sweep;
    return slice;
  });
  return {
    kind: 'pie',
    slices,
    innerRadiusRatio: chart.chartKind === 'doughnut' ? 0.55 : 0,
  };
}

/** Numeric x values for a scatter chart: parsed categories, index fallback. */
function scatterXs(chart: ChartElement, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const raw = chart.categories[i];
    if (raw === undefined) return i;
    const n = raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(n) ? n : i;
  });
}

function scatterLayout(chart: ChartElement, plotRect: Rect): ChartLayout {
  const maxLen = chart.series.reduce((m, s) => Math.max(m, s.values.length), 0);
  const xs = scatterXs(chart, Math.max(maxLen, chart.categories.length));
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const x of xs) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
  }
  if (xMin === Infinity) {
    xMin = 0;
    xMax = 0;
  }
  const vr = valueRange(chart);
  const xAxis = niceAxis(xMin, xMax);
  const yAxis = niceAxis(vr.min, vr.max);
  const series: SeriesPolyline[] = chart.series.map((s, si) => ({
    seriesIndex: si,
    points: s.values.map((v, i) => ({
      x: scale(xs[i] ?? i, xAxis.min, xAxis.max, plotRect.x, plotRect.x + plotRect.width),
      y: scale(v, yAxis.min, yAxis.max, plotRect.y + plotRect.height, plotRect.y),
    })),
  }));
  return { kind: 'scatter', series };
}

/**
 * Compute renderer-ready geometry for the chart within `plotRect`:
 * - bar/column: grouped bars with a 20% category gap, growing from the zero
 *   line ('bar' is the horizontal variant, negative values extend the other way)
 * - line/area: one polyline per series at category centers
 * - pie/doughnut: slices from -90 degrees (12 o'clock) clockwise summing to 360
 * - scatter: points with categories parsed as numeric x (index fallback)
 */
export function computeChartLayout(chart: ChartElement, plotRect: Rect): ChartLayout {
  switch (chart.chartKind) {
    case 'bar':
    case 'column':
      return barLayout(chart, plotRect);
    case 'line':
    case 'area':
      return lineLayout(chart, plotRect);
    case 'pie':
    case 'doughnut':
      return pieLayout(chart);
    case 'scatter':
      return scatterLayout(chart, plotRect);
  }
}

// ---------------------------------------------------------------------------
// Legend & colors
// ---------------------------------------------------------------------------

export interface LegendEntry {
  label: string;
  colorIndex: number;
}

/** Legend entries: series names, except pie/doughnut which list categories. */
export function legendEntries(chart: ChartElement): LegendEntry[] {
  if (chart.chartKind === 'pie' || chart.chartKind === 'doughnut') {
    return chart.categories.map((label, colorIndex) => ({ label, colorIndex }));
  }
  return chart.series.map((s, colorIndex) => ({ label: s.name, colorIndex }));
}

/** Default color slot for series/slice `i`, cycling accent1..accent6. */
export function defaultSeriesColorSlot(i: number): ThemeColorSlot {
  const idx = ((i % 6) + 6) % 6;
  return `accent${idx + 1}` as ThemeColorSlot;
}
