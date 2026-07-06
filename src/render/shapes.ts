/**
 * Preset shape geometry -> SVG element strings. Geometries not specially
 * handled fall back to a plain rectangle.
 */

import type { Rect, ShapeGeometry } from '../core/types';
import { degToRad, round } from '../core/util';
import { fmt } from './xml';

type NormPoint = readonly [number, number];

function starPoints(spikes: number, innerRatio: number): NormPoint[] {
  const points: NormPoint[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = -90 + (i * 180) / spikes;
    const radius = i % 2 === 0 ? 0.5 : 0.5 * innerRatio;
    points.push([
      round(0.5 + radius * Math.cos(degToRad(angle)), 4),
      round(0.5 + radius * Math.sin(degToRad(angle)), 4),
    ]);
  }
  return points;
}

/** Normalized (0..1) polygon outlines for the polygon-based geometries. */
const POLYGONS: Partial<Record<ShapeGeometry, NormPoint[]>> = {
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  rightTriangle: [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  pentagon: [
    [0.5, 0],
    [1, 0.38],
    [0.81, 1],
    [0.19, 1],
    [0, 0.38],
  ],
  hexagon: [
    [0.25, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0.25, 1],
    [0, 0.5],
  ],
  chevron: [
    [0, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0, 1],
    [0.25, 0.5],
  ],
  arrowRight: [
    [0, 0.25],
    [0.6, 0.25],
    [0.6, 0],
    [1, 0.5],
    [0.6, 1],
    [0.6, 0.75],
    [0, 0.75],
  ],
  arrowLeft: [
    [1, 0.25],
    [0.4, 0.25],
    [0.4, 0],
    [0, 0.5],
    [0.4, 1],
    [0.4, 0.75],
    [1, 0.75],
  ],
  arrowUp: [
    [0.5, 0],
    [1, 0.4],
    [0.75, 0.4],
    [0.75, 1],
    [0.25, 1],
    [0.25, 0.4],
    [0, 0.4],
  ],
  arrowDown: [
    [0.5, 1],
    [1, 0.6],
    [0.75, 0.6],
    [0.75, 0],
    [0.25, 0],
    [0.25, 0.6],
    [0, 0.6],
  ],
  star5: starPoints(5, 0.382),
  plus: [
    [1 / 3, 0],
    [2 / 3, 0],
    [2 / 3, 1 / 3],
    [1, 1 / 3],
    [1, 2 / 3],
    [2 / 3, 2 / 3],
    [2 / 3, 1],
    [1 / 3, 1],
    [1 / 3, 2 / 3],
    [0, 2 / 3],
    [0, 1 / 3],
    [1 / 3, 1 / 3],
  ],
  parallelogram: [
    [0.25, 0],
    [1, 0],
    [0.75, 1],
    [0, 1],
  ],
  trapezoid: [
    [0.25, 0],
    [0.75, 0],
    [1, 1],
    [0, 1],
  ],
};

function polygonSvg(points: NormPoint[], box: Rect, paint: string): string {
  const coords = points
    .map(([nx, ny]) => `${fmt(box.x + nx * box.width)},${fmt(box.y + ny * box.height)}`)
    .join(' ');
  return `<polygon points="${coords}"${paint}/>`;
}

function rectSvg(box: Rect, paint: string, rx?: number): string {
  const corner = rx !== undefined && rx > 0 ? ` rx="${fmt(rx)}"` : '';
  return (
    `<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}"` +
    ` height="${fmt(box.height)}"${corner}${paint}/>`
  );
}

/**
 * Render a preset geometry into `box` (already in the current coordinate
 * space). `paint` is a pre-built string of fill/stroke attributes (leading
 * space included). Unknown geometries fall back to a rectangle.
 */
export function shapeGeometrySvg(
  geometry: ShapeGeometry,
  box: Rect,
  adjustment: number | undefined,
  paint: string,
): string {
  const polygon = POLYGONS[geometry];
  if (polygon) {
    return polygonSvg(polygon, box, paint);
  }
  switch (geometry) {
    case 'rectangle':
      return rectSvg(box, paint);
    case 'roundedRectangle': {
      const ratio = adjustment ?? 0.16;
      const rx = Math.max(0, ratio) * Math.min(box.width, box.height);
      return rectSvg(box, paint, rx);
    }
    case 'ellipse':
      return (
        `<ellipse cx="${fmt(box.x + box.width / 2)}" cy="${fmt(box.y + box.height / 2)}"` +
        ` rx="${fmt(box.width / 2)}" ry="${fmt(box.height / 2)}"${paint}/>`
      );
    default:
      // Fallback: any geometry without a special outline renders as a rect.
      return rectSvg(box, paint);
  }
}
