/**
 * Chart element rendering: delegates geometry to src/charts
 * (computeChartLayout, niceAxis, valueRange, legendEntries) and turns the
 * resulting layout into SVG bars / lines / areas / pie slices / scatter dots
 * plus axes, legend and title.
 */

import type { ChartElement, Color, Point, Rect } from '../core/types';
import { degToRad } from '../core/util';
import {
  computeChartLayout,
  defaultSeriesColorSlot,
  legendEntries,
  niceAxis,
  valueRange,
  type NiceAxis,
} from '../charts';
import { resolveColorToCss, resolveFontFamily } from '../style';
import type { RenderContext } from './context';
import { escapeXml, fmt } from './xml';

const TITLE_HEIGHT = 24;
const LEGEND_STRIP = 18;
const LEGEND_SIDE_WIDTH = 90;
const AXIS_LEFT = 40;
const AXIS_BOTTOM = 18;
const LABEL_SIZE = 10;

/** CSS color for series/slice `index`: explicit series color, else accent cycle. */
export function chartSeriesColor(chart: ChartElement, index: number, ctx: RenderContext): string {
  const explicit: Color | undefined = chart.series[index]?.color;
  const color: Color = explicit ?? { type: 'theme', slot: defaultSeriesColorSlot(index) };
  return resolveColorToCss(color, ctx.scheme);
}

/** Color for a pie/doughnut slice or legend swatch by category index. */
function sliceColor(chart: ChartElement, categoryIndex: number, ctx: RenderContext): string {
  return resolveColorToCss(
    { type: 'theme', slot: defaultSeriesColorSlot(categoryIndex) },
    ctx.scheme,
  );
}

function isPieLike(chart: ChartElement): boolean {
  return chart.chartKind === 'pie' || chart.chartKind === 'doughnut';
}

function label(
  x: number,
  y: number,
  text: string,
  ctx: RenderContext,
  attrs = '',
): string {
  const family = escapeXml(resolveFontFamily('minor', ctx.theme.fontScheme));
  return (
    `<text x="${fmt(x)}" y="${fmt(y)}" font-family="${family}"` +
    ` font-size="${LABEL_SIZE}"${attrs}>${escapeXml(text)}</text>`
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = degToRad(angleDeg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG path for one pie/doughnut slice (annular when innerR > 0). */
function slicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  // A full-circle slice would collapse (arc start == end); split it in two.
  if (sweep >= 359.999) {
    const mid = startAngle + 180;
    return (
      slicePath(cx, cy, outerR, innerR, startAngle, mid) +
      ` ${slicePath(cx, cy, outerR, innerR, mid, endAngle)}`
    );
  }
  const laf = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, outerR, startAngle);
  const o2 = polar(cx, cy, outerR, endAngle);
  if (innerR <= 0) {
    return (
      `M ${fmt(cx)} ${fmt(cy)} L ${fmt(o1.x)} ${fmt(o1.y)}` +
      ` A ${fmt(outerR)} ${fmt(outerR)} 0 ${laf} 1 ${fmt(o2.x)} ${fmt(o2.y)} Z`
    );
  }
  const i1 = polar(cx, cy, innerR, startAngle);
  const i2 = polar(cx, cy, innerR, endAngle);
  return (
    `M ${fmt(o1.x)} ${fmt(o1.y)}` +
    ` A ${fmt(outerR)} ${fmt(outerR)} 0 ${laf} 1 ${fmt(o2.x)} ${fmt(o2.y)}` +
    ` L ${fmt(i2.x)} ${fmt(i2.y)}` +
    ` A ${fmt(innerR)} ${fmt(innerR)} 0 ${laf} 0 ${fmt(i1.x)} ${fmt(i1.y)} Z`
  );
}

function valueToY(v: number, axis: NiceAxis, plot: Rect): number {
  if (axis.max === axis.min) {
    return plot.y + plot.height / 2;
  }
  return plot.y + plot.height - ((v - axis.min) / (axis.max - axis.min)) * plot.height;
}

function valueToX(v: number, axis: NiceAxis, plot: Rect): number {
  if (axis.max === axis.min) {
    return plot.x + plot.width / 2;
  }
  return plot.x + ((v - axis.min) / (axis.max - axis.min)) * plot.width;
}

/** Axis lines, value ticks + labels and category labels for cartesian charts. */
function renderAxes(chart: ChartElement, axis: NiceAxis, plot: Rect, ctx: RenderContext): string {
  const out: string[] = [];
  const axisStroke = ' stroke="#9AA0A6" stroke-width="0.75"';
  const left = plot.x;
  const bottom = plot.y + plot.height;
  out.push(`<line x1="${fmt(left)}" y1="${fmt(plot.y)}" x2="${fmt(left)}" y2="${fmt(bottom)}"${axisStroke}/>`);
  out.push(`<line x1="${fmt(left)}" y1="${fmt(bottom)}" x2="${fmt(plot.x + plot.width)}" y2="${fmt(bottom)}"${axisStroke}/>`);

  const horizontalBars = chart.chartKind === 'bar';
  for (const tick of axis.ticks) {
    if (horizontalBars) {
      const x = valueToX(tick, axis, plot);
      out.push(
        `<line x1="${fmt(x)}" y1="${fmt(plot.y)}" x2="${fmt(x)}" y2="${fmt(bottom)}" stroke="#E0E0E0" stroke-width="0.5"/>`,
      );
      out.push(label(x, bottom + 12, String(tick), ctx, ' text-anchor="middle" class="tick"'));
    } else {
      const y = valueToY(tick, axis, plot);
      out.push(
        `<line x1="${fmt(left)}" y1="${fmt(y)}" x2="${fmt(plot.x + plot.width)}" y2="${fmt(y)}" stroke="#E0E0E0" stroke-width="0.5"/>`,
      );
      out.push(label(left - 4, y + 3, String(tick), ctx, ' text-anchor="end" class="tick"'));
    }
  }

  // Category labels (scatter has a numeric x axis instead).
  if (chart.chartKind !== 'scatter') {
    const n = Math.max(1, chart.categories.length);
    chart.categories.forEach((cat, i) => {
      if (horizontalBars) {
        const slot = plot.height / n;
        out.push(
          label(left - 4, plot.y + (i + 0.5) * slot + 3, cat, ctx, ' text-anchor="end" class="cat"'),
        );
      } else {
        const slot = plot.width / n;
        out.push(
          label(plot.x + (i + 0.5) * slot, bottom + 12, cat, ctx, ' text-anchor="middle" class="cat"'),
        );
      }
    });
  }
  return out.join('');
}

function renderLegend(chart: ChartElement, box: Rect, ctx: RenderContext): string {
  const entries = legendEntries(chart);
  if (entries.length === 0) {
    return '';
  }
  const out: string[] = [];
  const horizontal = chart.legendPosition === 'top' || chart.legendPosition === 'bottom';
  const itemW = horizontal ? box.width / entries.length : box.width;
  const itemH = horizontal ? box.height : 16;
  entries.forEach((entry, i) => {
    const x = horizontal ? box.x + i * itemW : box.x;
    const y = horizontal ? box.y : box.y + i * itemH;
    const color = isPieLike(chart)
      ? sliceColor(chart, entry.colorIndex, ctx)
      : chartSeriesColor(chart, entry.colorIndex, ctx);
    out.push(
      `<rect x="${fmt(x)}" y="${fmt(y + itemH / 2 - 4)}" width="8" height="8" fill="${escapeXml(color)}" class="legend-swatch"/>`,
    );
    out.push(label(x + 11, y + itemH / 2 + 3.5, entry.label, ctx, ' class="legend-label"'));
  });
  return `<g class="legend">${out.join('')}</g>`;
}

/** Render a chart element's full content (coordinates in the current space). */
export function renderChart(chart: ChartElement, ctx: RenderContext): string {
  const t = chart.transform;
  const out: string[] = [];

  // Carve title / legend / axis space out of the element box.
  let plot: Rect = { x: t.x, y: t.y, width: t.width, height: t.height };
  if (chart.title) {
    plot = { ...plot, y: plot.y + TITLE_HEIGHT, height: plot.height - TITLE_HEIGHT };
  }
  let legendBox: Rect | undefined;
  if (chart.showLegend) {
    switch (chart.legendPosition) {
      case 'top':
        legendBox = { x: plot.x, y: plot.y, width: plot.width, height: LEGEND_STRIP };
        plot = { ...plot, y: plot.y + LEGEND_STRIP, height: plot.height - LEGEND_STRIP };
        break;
      case 'bottom':
        legendBox = {
          x: plot.x,
          y: plot.y + plot.height - LEGEND_STRIP,
          width: plot.width,
          height: LEGEND_STRIP,
        };
        plot = { ...plot, height: plot.height - LEGEND_STRIP };
        break;
      case 'left':
        legendBox = { x: plot.x, y: plot.y, width: LEGEND_SIDE_WIDTH, height: plot.height };
        plot = { ...plot, x: plot.x + LEGEND_SIDE_WIDTH, width: plot.width - LEGEND_SIDE_WIDTH };
        break;
      case 'right':
        legendBox = {
          x: plot.x + plot.width - LEGEND_SIDE_WIDTH,
          y: plot.y,
          width: LEGEND_SIDE_WIDTH,
          height: plot.height,
        };
        plot = { ...plot, width: plot.width - LEGEND_SIDE_WIDTH };
        break;
    }
  }
  if (!isPieLike(chart)) {
    plot = {
      x: plot.x + AXIS_LEFT,
      y: plot.y,
      width: Math.max(1, plot.width - AXIS_LEFT),
      height: Math.max(1, plot.height - AXIS_BOTTOM),
    };
  }

  if (chart.title) {
    const family = escapeXml(resolveFontFamily('minor', ctx.theme.fontScheme));
    out.push(
      `<text x="${fmt(t.x + t.width / 2)}" y="${fmt(t.y + 15)}" text-anchor="middle"` +
        ` font-family="${family}" font-size="13" font-weight="bold" class="chart-title">` +
        `${escapeXml(chart.title)}</text>`,
    );
  }

  const layout = computeChartLayout(chart, plot);
  const vr = valueRange(chart);
  const axis = niceAxis(vr.min, vr.max);

  switch (layout.kind) {
    case 'bars': {
      out.push(renderAxes(chart, axis, plot, ctx));
      for (const bar of layout.bars) {
        const fill = chartSeriesColor(chart, bar.seriesIndex, ctx);
        out.push(
          `<rect x="${fmt(bar.rect.x)}" y="${fmt(bar.rect.y)}" width="${fmt(bar.rect.width)}"` +
            ` height="${fmt(bar.rect.height)}" fill="${escapeXml(fill)}" class="bar"/>`,
        );
        if (chart.showDataLabels) {
          out.push(
            label(
              bar.rect.x + bar.rect.width / 2,
              bar.rect.y - 3,
              String(bar.value),
              ctx,
              ' text-anchor="middle" class="data-label"',
            ),
          );
        }
      }
      break;
    }
    case 'lines': {
      out.push(renderAxes(chart, axis, plot, ctx));
      const baselineY = valueToY(Math.max(axis.min, Math.min(axis.max, 0)), axis, plot);
      for (const line of layout.lines) {
        const color = chartSeriesColor(chart, line.seriesIndex, ctx);
        const pts = line.points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
        if (line.points.length === 0) {
          continue;
        }
        if (chart.chartKind === 'area') {
          const first = line.points[0];
          const last = line.points[line.points.length - 1];
          const area =
            `${pts} ${fmt(last.x)},${fmt(baselineY)} ${fmt(first.x)},${fmt(baselineY)}`;
          out.push(
            `<polygon points="${area}" fill="${escapeXml(color)}" fill-opacity="0.4" class="area"/>`,
          );
        }
        out.push(
          `<polyline points="${pts}" fill="none" stroke="${escapeXml(color)}" stroke-width="2" class="series-line"/>`,
        );
      }
      break;
    }
    case 'pie': {
      const cx = plot.x + plot.width / 2;
      const cy = plot.y + plot.height / 2;
      const outerR = Math.max(1, (Math.min(plot.width, plot.height) / 2) * 0.9);
      const innerR = outerR * layout.innerRadiusRatio;
      for (const slice of layout.slices) {
        const fill = sliceColor(chart, slice.categoryIndex, ctx);
        out.push(
          `<path d="${slicePath(cx, cy, outerR, innerR, slice.startAngle, slice.endAngle)}"` +
            ` fill="${escapeXml(fill)}" stroke="#FFFFFF" stroke-width="1" class="slice"/>`,
        );
        if (chart.showDataLabels && slice.percent > 0) {
          const mid = (slice.startAngle + slice.endAngle) / 2;
          const at = polar(cx, cy, (outerR + innerR) / 2 + (innerR > 0 ? 0 : outerR * 0.2), mid);
          out.push(
            label(at.x, at.y, `${Math.round(slice.percent)}%`, ctx, ' text-anchor="middle" class="data-label"'),
          );
        }
      }
      break;
    }
    case 'scatter': {
      out.push(renderAxes(chart, axis, plot, ctx));
      for (const series of layout.series) {
        const color = chartSeriesColor(chart, series.seriesIndex, ctx);
        for (const p of series.points) {
          out.push(
            `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="3" fill="${escapeXml(color)}" class="dot"/>`,
          );
        }
      }
      break;
    }
  }

  if (legendBox) {
    out.push(renderLegend(chart, legendBox, ctx));
  }
  return `<g class="chart">${out.join('')}</g>`;
}
