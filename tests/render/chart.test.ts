import { describe, expect, it } from 'vitest';
import type { ChartElement } from '../../src/core/types';
import { createChart, setChartData } from '../../src/charts';
import { renderSlideSVG } from '../../src/render';
import { newPres, slideWith, wellFormedError } from './helpers';

function barRects(svg: string): { x: number; y: number; w: number; h: number }[] {
  return [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" fill="[^"]*" class="bar"\/>/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }),
  );
}

function chartOn(chart: ChartElement) {
  const pres = newPres();
  const slide = slideWith(pres, chart);
  return renderSlideSVG(pres, slide);
}

describe('chart rendering', () => {
  it('column chart renders one bar per series x category', () => {
    const chart = createChart('column'); // 2 series x 3 categories
    const svg = chartOn(chart);
    expect(barRects(svg)).toHaveLength(6);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('negative values render bars below the zero baseline', () => {
    const chart = createChart('column');
    setChartData(chart, ['Pos', 'Neg'], [{ name: 'S1', values: [4, -4] }]);
    const svg = chartOn(chart);
    const bars = barRects(svg);
    expect(bars).toHaveLength(2);
    const [pos, neg] = bars;
    // The negative bar hangs from the zero line, which is the positive bar's bottom.
    expect(neg.y).toBeCloseTo(pos.y + pos.h, 1);
    expect(neg.h).toBeCloseTo(pos.h, 1);
  });

  it('bar chart lays bars out horizontally', () => {
    const chart = createChart('bar');
    setChartData(chart, ['A', 'B'], [{ name: 'S1', values: [2, 4] }]);
    const bars = barRects(chartOn(chart));
    expect(bars).toHaveLength(2);
    expect(bars[1].w).toBeGreaterThan(bars[0].w);
    expect(bars[0].x).toBeCloseTo(bars[1].x, 1);
  });

  it('pie chart renders one path slice per category', () => {
    const chart = createChart('pie');
    setChartData(
      chart,
      ['Alpha', 'Beta', 'Gamma', 'Delta'],
      [{ name: 'S1', values: [1, 2, 3, 4] }],
    );
    const svg = chartOn(chart);
    expect((svg.match(/class="slice"/g) ?? []).length).toBe(4);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('doughnut slices are annular (outer + inner arc per slice)', () => {
    const chart = createChart('doughnut');
    setChartData(chart, ['A', 'B'], [{ name: 'S1', values: [1, 1] }]);
    const svg = chartOn(chart);
    const slice = /<path d="([^"]+)"[^>]*class="slice"/.exec(svg);
    expect(slice).not.toBeNull();
    expect((slice![1].match(/ A /g) ?? []).length).toBe(2);
  });

  it('a single-category pie renders a full circle without collapsing', () => {
    const chart = createChart('pie');
    setChartData(chart, ['Only'], [{ name: 'S1', values: [7] }]);
    const svg = chartOn(chart);
    expect((svg.match(/class="slice"/g) ?? []).length).toBe(1);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('line chart renders one polyline per series', () => {
    const chart = createChart('line');
    const svg = chartOn(chart);
    expect((svg.match(/class="series-line"/g) ?? []).length).toBe(2);
  });

  it('area chart adds a filled polygon under each series line', () => {
    const chart = createChart('area');
    const svg = chartOn(chart);
    expect((svg.match(/class="area"/g) ?? []).length).toBe(2);
    expect(svg).toContain('fill-opacity="0.4"');
  });

  it('scatter chart renders a dot per value', () => {
    const chart = createChart('scatter');
    setChartData(
      chart,
      ['1', '2', '3'],
      [
        { name: 'S1', values: [1, 2, 3] },
        { name: 'S2', values: [3, 2, 1] },
      ],
    );
    const svg = chartOn(chart);
    expect((svg.match(/class="dot"/g) ?? []).length).toBe(6);
  });

  it('renders the chart title', () => {
    const chart = createChart('column');
    chart.title = 'Revenue & Growth';
    const svg = chartOn(chart);
    expect(svg).toContain('class="chart-title"');
    expect(svg).toContain('Revenue &amp; Growth');
  });

  it('renders legend entries for series names', () => {
    const chart = createChart('column');
    chart.series[0].name = 'North';
    chart.series[1].name = 'South';
    const svg = chartOn(chart);
    expect((svg.match(/class="legend-swatch"/g) ?? []).length).toBe(2);
    expect(svg).toContain('>North</text>');
    expect(svg).toContain('>South</text>');
  });

  it('pie legends list categories instead of series', () => {
    const chart = createChart('pie');
    setChartData(chart, ['Cats', 'Dogs'], [{ name: 'Pets', values: [3, 5] }]);
    const svg = chartOn(chart);
    expect(svg).toContain('>Cats</text>');
    expect(svg).toContain('>Dogs</text>');
    expect(svg).not.toContain('>Pets</text>');
  });

  it('hiding the legend removes it', () => {
    const chart = createChart('column');
    chart.showLegend = false;
    expect(chartOn(chart)).not.toContain('class="legend"');
  });

  it('draws value-axis ticks including the axis maximum', () => {
    const chart = createChart('column');
    setChartData(chart, ['A'], [{ name: 'S1', values: [10] }]);
    const svg = chartOn(chart);
    expect(svg).toMatch(/class="tick">0<\/text>/);
    expect(svg).toMatch(/class="tick">10<\/text>/);
  });

  it('draws category labels', () => {
    const chart = createChart('column');
    setChartData(chart, ['Q1', 'Q2', 'Q3'], [{ name: 'S1', values: [1, 2, 3] }]);
    const svg = chartOn(chart);
    expect(svg).toContain('>Q1</text>');
    expect(svg).toContain('>Q3</text>');
  });

  it('uses explicit series colors when set', () => {
    const chart = createChart('column');
    chart.series[0].color = { type: 'rgb', value: 'FF0000' };
    const svg = chartOn(chart);
    expect(svg).toMatch(/<rect [^>]*fill="rgb\(255, 0, 0\)" class="bar"/);
  });

  it('shows data labels when enabled', () => {
    const chart = createChart('column');
    chart.showDataLabels = true;
    setChartData(chart, ['A'], [{ name: 'S1', values: [42] }]);
    const svg = chartOn(chart);
    expect(svg).toMatch(/class="data-label">42<\/text>/);
  });

  it('renders a rotated chart with a transform group', () => {
    const chart = createChart('column', { rotation: 15 });
    const svg = chartOn(chart);
    expect(svg).toMatch(/transform="rotate\(15 /);
    expect(wellFormedError(svg)).toBeNull();
  });
});
