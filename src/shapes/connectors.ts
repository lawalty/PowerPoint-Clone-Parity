/**
 * Connector routing: resolve a LineElement's absolute start/end points.
 *
 * Connection sites are on the target element's rotation-aware bounds:
 *   0 = N (top center), 1 = E (right middle), 2 = S (bottom center),
 *   3 = W (left middle).
 * When an endpoint is unattached (or its target can't be resolved), it falls
 * back to the line's own transform corners; flipH/flipV indicate which
 * diagonal of the box the line runs along.
 */

import type { Id, LineElement, Point, SlideElement } from '../core/types';
import { getBounds } from './geometry';

/** The four connection sites (N, E, S, W) of an element's bounds. */
export function getConnectionSites(el: SlideElement): [Point, Point, Point, Point] {
  const b = getBounds(el);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return [
    { x: cx, y: b.y },
    { x: b.x + b.width, y: cy },
    { x: cx, y: b.y + b.height },
    { x: b.x, y: cy },
  ];
}

function siteOf(el: SlideElement, site: number): Point {
  const sites = getConnectionSites(el);
  return sites[((site % 4) + 4) % 4];
}

/** The line's own endpoints from its transform box, honoring flips. */
export function lineTransformEndpoints(line: LineElement): { start: Point; end: Point } {
  const t = line.transform;
  const x1 = t.flipH ? t.x + t.width : t.x;
  const x2 = t.flipH ? t.x : t.x + t.width;
  const y1 = t.flipV ? t.y + t.height : t.y;
  const y2 = t.flipV ? t.y : t.y + t.height;
  return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}

/**
 * Compute the absolute start/end points of a connector. Attached endpoints
 * snap to their target's connection site; unattached (or unresolvable) ends
 * use the line's own transform corners.
 */
export function computeConnectorEndpoints(
  line: LineElement,
  resolveElement: (id: Id) => SlideElement | undefined,
): { start: Point; end: Point } {
  const fallback = lineTransformEndpoints(line);
  let start = fallback.start;
  let end = fallback.end;

  if (line.startAttachment) {
    const target = resolveElement(line.startAttachment.elementId);
    if (target) start = siteOf(target, line.startAttachment.site);
  }
  if (line.endAttachment) {
    const target = resolveElement(line.endAttachment.elementId);
    if (target) end = siteOf(target, line.endAttachment.site);
  }
  return { start, end };
}
