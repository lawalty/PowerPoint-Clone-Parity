/**
 * Easing/progress helpers used while playing animations.
 */

import type { Animation, Point } from '../core/types';
import { clamp } from '../core/util';

/**
 * Progress of an animation, 0..1 clamped, given the elapsed time (ms) since
 * its trigger fired. The animation's delay is waited out first, then progress
 * runs linearly across `duration * repeat`.
 */
export function animationProgress(anim: Animation, elapsedMs: number): number {
  const total = anim.duration * Math.max(1, anim.repeat);
  const active = elapsedMs - anim.delay;
  if (total <= 0) return active >= 0 ? 1 : 0;
  return clamp(active / total, 0, 1);
}

/**
 * Point at parameter t (0..1, clamped) along a polyline, interpolated
 * piecewise-linearly by arc length. Throws on an empty path.
 */
export function interpolateAlongPath(path: Point[], t: number): Point {
  if (path.length === 0) {
    throw new Error('interpolateAlongPath: path must contain at least one point');
  }
  if (path.length === 1) return { x: path[0].x, y: path[0].y };

  const tc = clamp(t, 0, 1);

  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segmentLengths.push(len);
    totalLength += len;
  }
  if (totalLength === 0) return { x: path[0].x, y: path[0].y };

  let remaining = tc * totalLength;
  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    if (remaining <= len || i === segmentLengths.length - 1) {
      const f = len === 0 ? 0 : clamp(remaining / len, 0, 1);
      const a = path[i];
      const b = path[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    remaining -= len;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}
