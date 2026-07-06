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
  star4: starPoints(4, 0.3),
  star5: starPoints(5, 0.382),
  star6: starPoints(6, 0.5),
  lightningBolt: [
    [0.4, 0],
    [0.85, 0],
    [0.55, 0.38],
    [0.75, 0.38],
    [0.25, 1],
    [0.42, 0.55],
    [0.2, 0.55],
  ],
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

/**
 * Curved geometries expressed as normalized path builders. Each builder
 * receives helpers mapping normalized coordinates / radii into the box and
 * returns an SVG path `d` string.
 */
interface PathHelpers {
  /** "x y" pair for a normalized point. */
  p(nx: number, ny: number): string;
  /** Scaled x radius. */
  rx(n: number): string;
  /** Scaled y radius. */
  ry(n: number): string;
}

type PathBuilder = (h: PathHelpers) => string;

/** Geometries drawn as paths. `evenOdd` marks ones with punched-out holes. */
const PATHS: Partial<Record<ShapeGeometry, { d: PathBuilder; evenOdd?: boolean }>> = {
  heart: {
    d: (h) =>
      `M ${h.p(0.5, 0.32)} ` +
      `C ${h.p(0.5, 0.12)} ${h.p(0.32, 0)} ${h.p(0.18, 0)} ` +
      `C ${h.p(0.05, 0)} ${h.p(0, 0.14)} ${h.p(0, 0.3)} ` +
      `C ${h.p(0, 0.52)} ${h.p(0.2, 0.68)} ${h.p(0.5, 1)} ` +
      `C ${h.p(0.8, 0.68)} ${h.p(1, 0.52)} ${h.p(1, 0.3)} ` +
      `C ${h.p(1, 0.14)} ${h.p(0.95, 0)} ${h.p(0.82, 0)} ` +
      `C ${h.p(0.68, 0)} ${h.p(0.5, 0.12)} ${h.p(0.5, 0.32)} Z`,
  },
  cloud: {
    d: (h) =>
      `M ${h.p(0.25, 0.85)} ` +
      `C ${h.p(0.1, 0.85)} ${h.p(0, 0.74)} ${h.p(0, 0.58)} ` +
      `C ${h.p(0, 0.44)} ${h.p(0.08, 0.34)} ${h.p(0.2, 0.32)} ` +
      `C ${h.p(0.22, 0.16)} ${h.p(0.35, 0.05)} ${h.p(0.5, 0.05)} ` +
      `C ${h.p(0.63, 0.05)} ${h.p(0.74, 0.13)} ${h.p(0.79, 0.26)} ` +
      `C ${h.p(0.9, 0.26)} ${h.p(1, 0.36)} ${h.p(1, 0.52)} ` +
      `C ${h.p(1, 0.7)} ${h.p(0.9, 0.85)} ${h.p(0.75, 0.85)} Z`,
  },
  speechBubble: {
    d: (h) =>
      `M ${h.p(0.1, 0)} L ${h.p(0.9, 0)} ` +
      `Q ${h.p(1, 0)} ${h.p(1, 0.12)} L ${h.p(1, 0.58)} ` +
      `Q ${h.p(1, 0.7)} ${h.p(0.9, 0.7)} L ${h.p(0.38, 0.7)} ` +
      `L ${h.p(0.18, 1)} L ${h.p(0.22, 0.7)} L ${h.p(0.1, 0.7)} ` +
      `Q ${h.p(0, 0.7)} ${h.p(0, 0.58)} L ${h.p(0, 0.12)} ` +
      `Q ${h.p(0, 0)} ${h.p(0.1, 0)} Z`,
  },
  pie: {
    // Wedge from 12 o'clock sweeping 270 degrees clockwise to 9 o'clock.
    d: (h) =>
      `M ${h.p(0.5, 0.5)} L ${h.p(0.5, 0)} ` +
      `A ${h.rx(0.5)} ${h.ry(0.5)} 0 1 1 ${h.p(0, 0.5)} Z`,
  },
  donut: {
    d: (h) =>
      `M ${h.p(0.5, 0)} ` +
      `A ${h.rx(0.5)} ${h.ry(0.5)} 0 1 1 ${h.p(0.4999, 0)} Z ` +
      `M ${h.p(0.5, 0.25)} ` +
      `A ${h.rx(0.25)} ${h.ry(0.25)} 0 1 0 ${h.p(0.4999, 0.25)} Z`,
    evenOdd: true,
  },
  blockArc: {
    // Half ring: outer arc over the top, inner arc back.
    d: (h) =>
      `M ${h.p(0, 0.5)} A ${h.rx(0.5)} ${h.ry(0.5)} 0 0 1 ${h.p(1, 0.5)} ` +
      `L ${h.p(0.75, 0.5)} A ${h.rx(0.25)} ${h.ry(0.25)} 0 0 0 ${h.p(0.25, 0.5)} Z`,
  },
  frame: {
    d: (h) =>
      `M ${h.p(0, 0)} L ${h.p(1, 0)} L ${h.p(1, 1)} L ${h.p(0, 1)} Z ` +
      `M ${h.p(0.15, 0.15)} L ${h.p(0.85, 0.15)} L ${h.p(0.85, 0.85)} ` +
      `L ${h.p(0.15, 0.85)} Z`,
    evenOdd: true,
  },
};

function pathHelpers(box: Rect): PathHelpers {
  return {
    p: (nx, ny) => `${fmt(box.x + nx * box.width)} ${fmt(box.y + ny * box.height)}`,
    rx: (n) => fmt(n * box.width),
    ry: (n) => fmt(n * box.height),
  };
}

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
  const path = PATHS[geometry];
  if (path) {
    const rule = path.evenOdd ? ' fill-rule="evenodd"' : '';
    return `<path d="${path.d(pathHelpers(box))}"${rule}${paint}/>`;
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
