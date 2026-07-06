/**
 * Grid snapping helpers.
 */

import type { Transform } from '../core/types';
import { round } from '../core/util';

/**
 * Snap a value to the nearest multiple of gridSize when within threshold.
 * With no threshold given, always snaps to the nearest grid line.
 * A gridSize <= 0 returns the value unchanged.
 */
export function snapValue(value: number, gridSize: number, threshold = Infinity): number {
  if (gridSize <= 0) return value;
  const nearest = Math.round(value / gridSize) * gridSize;
  return Math.abs(value - nearest) <= threshold ? round(nearest) : value;
}

/**
 * Snap a transform's position (and, optionally, size) to the grid, mutating
 * and returning it. Only values within threshold of a grid line move.
 */
export function snapTransformToGrid(
  t: Transform,
  gridSize: number,
  threshold = Infinity,
  snapSize = false,
): Transform {
  t.x = snapValue(t.x, gridSize, threshold);
  t.y = snapValue(t.y, gridSize, threshold);
  if (snapSize) {
    t.width = snapValue(t.width, gridSize, threshold);
    t.height = snapValue(t.height, gridSize, threshold);
  }
  return t;
}
