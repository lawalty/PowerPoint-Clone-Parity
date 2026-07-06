import { describe, expect, it } from 'vitest';
import {
  computeConnectorEndpoints,
  createLine,
  createShape,
  duplicateElement,
  getConnectionSites,
  groupElements,
  snapTransformToGrid,
  snapValue,
  visitElements,
} from '../../src/shapes';
import { defaultTextBody, defaultTransform } from '../../src/core/defaults';
import { genId } from '../../src/core/util';
import type { SlideElement, TableElement } from '../../src/core/types';

const rect = (x: number, y: number, w: number, h: number) =>
  createShape('rectangle', { x, y, width: w, height: h });

describe('duplicateElement', () => {
  it('deep-clones with a new id and (12, 12) offset', () => {
    const s = rect(30, 40, 50, 60);
    const d = duplicateElement(s);
    expect(d.id).not.toBe(s.id);
    expect(d.transform.x).toBe(42);
    expect(d.transform.y).toBe(52);
    expect(d.geometry).toBe(s.geometry);
    expect(d.fill).toEqual(s.fill);
    expect(d.fill).not.toBe(s.fill); // deep clone, not shared reference
    expect(s.transform.x).toBe(30); // original untouched
  });

  it('gives all-new ids to every descendant of a nested group', () => {
    const a = rect(0, 0, 10, 10);
    const b = rect(20, 0, 10, 10);
    const inner = groupElements([a, b]);
    const outer = groupElements([inner, rect(50, 50, 10, 10)]);
    const copy = duplicateElement(outer);

    const originalIds = new Set<string>();
    visitElements([outer], (el) => void originalIds.add(el.id));
    const copyIds: string[] = [];
    visitElements([copy], (el) => void copyIds.push(el.id));

    expect(copyIds).toHaveLength(5);
    expect(new Set(copyIds).size).toBe(5); // all unique
    for (const id of copyIds) expect(originalIds.has(id)).toBe(false);
    expect(copy.type).toBe('group');
    expect(copy.children).toHaveLength(2);
  });

  it('regenerates table cell ids', () => {
    const mkCell = () => ({
      id: genId('cell'),
      textBody: defaultTextBody(),
      fill: { type: 'none' } as const,
      borders: {},
      rowSpan: 1,
      colSpan: 1,
      merged: false,
    });
    const table: TableElement = {
      id: genId('table'),
      name: 'Table 1',
      type: 'table',
      transform: defaultTransform({ width: 200, height: 100 }),
      hidden: false,
      locked: false,
      rows: [
        { height: 50, cells: [mkCell(), mkCell()] },
        { height: 50, cells: [mkCell(), mkCell()] },
      ],
      columnWidths: [100, 100],
      firstRowHeader: true,
      bandedRows: true,
      bandedColumns: false,
      styleAccent: 'accent1',
    };
    const copy = duplicateElement(table);
    const origCellIds = table.rows.flatMap((r) => r.cells.map((c) => c.id));
    const copyCellIds = copy.rows.flatMap((r) => r.cells.map((c) => c.id));
    expect(copyCellIds).toHaveLength(4);
    expect(new Set(copyCellIds).size).toBe(4);
    for (const id of copyCellIds) expect(origCellIds).not.toContain(id);
  });
});

describe('snapping', () => {
  it('snapValue snaps to the nearest grid line within threshold', () => {
    expect(snapValue(13, 10, 5)).toBe(10);
    expect(snapValue(18, 10, 2)).toBe(20);
    expect(snapValue(17, 10, 2)).toBe(17); // outside threshold
    expect(snapValue(-13, 10, 5)).toBe(-10);
    expect(snapValue(25, 10)).toBe(30); // default threshold: always snap (ties round up)
    expect(snapValue(13, 0, 5)).toBe(13); // degenerate grid
  });

  it('snapTransformToGrid snaps position, and size only when asked', () => {
    const t = defaultTransform({ x: 13, y: 27, width: 98, height: 52 });
    snapTransformToGrid(t, 10, 5);
    expect(t.x).toBe(10);
    expect(t.y).toBe(30);
    expect(t.width).toBe(98); // size untouched by default
    const t2 = defaultTransform({ x: 13, y: 27, width: 98, height: 52 });
    snapTransformToGrid(t2, 10, 5, true);
    expect(t2).toMatchObject({ x: 10, y: 30, width: 100, height: 50 });
  });
});

describe('connectors', () => {
  it('getConnectionSites returns N, E, S, W of the bounds', () => {
    const s = rect(0, 0, 100, 100);
    expect(getConnectionSites(s)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ]);
  });

  it('attached endpoints snap to the target connection sites', () => {
    const a = rect(0, 0, 100, 100);
    const b = rect(200, 0, 100, 100);
    const line = createLine('straight', { x: 0, y: 0, width: 1, height: 1 });
    line.startAttachment = { elementId: a.id, site: 1 }; // E of a
    line.endAttachment = { elementId: b.id, site: 3 }; // W of b
    const byId = new Map<string, SlideElement>([[a.id, a], [b.id, b]]);
    const { start, end } = computeConnectorEndpoints(line, (id) => byId.get(id));
    expect(start).toEqual({ x: 100, y: 50 });
    expect(end).toEqual({ x: 200, y: 50 });
  });

  it('sites follow a rotated shape via its rotation-aware bounds', () => {
    const bar = createShape('rectangle', { x: 0, y: 0, width: 100, height: 20, rotation: 90 });
    // rotated bounds: x 40..60, y -40..60 → N site = (50, -40)
    const line = createLine();
    line.startAttachment = { elementId: bar.id, site: 0 };
    const { start } = computeConnectorEndpoints(line, () => bar);
    expect(start.x).toBeCloseTo(50, 3);
    expect(start.y).toBeCloseTo(-40, 3);
  });

  it('falls back to the line transform corners when unattached', () => {
    const line = createLine('straight', { x: 10, y: 20, width: 80, height: 40 });
    const { start, end } = computeConnectorEndpoints(line, () => undefined);
    expect(start).toEqual({ x: 10, y: 20 });
    expect(end).toEqual({ x: 90, y: 60 });
  });

  it('fallback honors flips to pick the line direction', () => {
    const line = createLine('straight', {
      x: 10, y: 10, width: 80, height: 40, flipH: true,
    });
    const { start, end } = computeConnectorEndpoints(line, () => undefined);
    expect(start).toEqual({ x: 90, y: 10 });
    expect(end).toEqual({ x: 10, y: 50 });
  });

  it('uses fallback per-endpoint when only one attachment resolves', () => {
    const a = rect(0, 0, 100, 100);
    const line = createLine('straight', { x: 300, y: 300, width: 50, height: 50 });
    line.startAttachment = { elementId: a.id, site: 2 }; // S of a
    line.endAttachment = { elementId: 'deleted-shape', site: 0 }; // unresolvable
    const { start, end } = computeConnectorEndpoints(line, (id) => (id === a.id ? a : undefined));
    expect(start).toEqual({ x: 50, y: 100 });
    expect(end).toEqual({ x: 350, y: 350 }); // line's own end corner
  });
});
