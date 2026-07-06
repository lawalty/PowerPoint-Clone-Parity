import { describe, expect, it } from 'vitest';
import {
  createTable,
  mergeCells,
  cellRect,
  rowY,
  colX,
  tableSize,
  hitTestCell,
  setCellFill,
  effectiveCellFill,
  tintHex,
  resizeColumn,
} from '../../src/tables';
import type { Fill } from '../../src/core/types';

describe('geometry', () => {
  it('rowY / colX / tableSize account for the transform origin', () => {
    const t = createTable(3, 3, { x: 10, y: 20, width: 300, height: 90 });
    expect(colX(t, 0)).toBe(10);
    expect(colX(t, 2)).toBe(210);
    expect(colX(t, 3)).toBe(310); // far edge is addressable
    expect(rowY(t, 0)).toBe(20);
    expect(rowY(t, 3)).toBe(110);
    expect(tableSize(t)).toEqual({ width: 300, height: 90 });
  });

  it('cellRect returns slide-space rects and honors uneven sizes', () => {
    const t = createTable(2, 2, { x: 5, y: 5, width: 200, height: 80 });
    resizeColumn(t, 0, 150);
    expect(cellRect(t, 0, 0)).toEqual({ x: 5, y: 5, width: 150, height: 40 });
    expect(cellRect(t, 1, 1)).toEqual({ x: 155, y: 45, width: 100, height: 40 });
  });

  it('cellRect spans the full merged region, also from covered cells', () => {
    const t = createTable(3, 3, { x: 10, y: 20, width: 300, height: 90 });
    mergeCells(t, 0, 0, 1, 1);
    const expected = { x: 10, y: 20, width: 200, height: 60 };
    expect(cellRect(t, 0, 0)).toEqual(expected);
    expect(cellRect(t, 1, 1)).toEqual(expected); // covered resolves to anchor
    expect(cellRect(t, 2, 2)).toEqual({ x: 210, y: 80, width: 100, height: 30 });
  });

  it('hitTestCell finds cells and returns null outside', () => {
    const t = createTable(3, 3, { x: 10, y: 20, width: 300, height: 90 });
    expect(hitTestCell(t, { x: 60, y: 35 })).toEqual({ row: 0, col: 0 });
    expect(hitTestCell(t, { x: 150, y: 85 })).toEqual({ row: 2, col: 1 });
    expect(hitTestCell(t, { x: 250, y: 45 })).toEqual({ row: 0, col: 2 });
    expect(hitTestCell(t, { x: 9.99, y: 30 })).toBeNull();
    expect(hitTestCell(t, { x: 311, y: 30 })).toBeNull();
    expect(hitTestCell(t, { x: 50, y: 110.5 })).toBeNull();
  });

  it('hitTestCell boundary semantics: interior edges go to the next cell, outer edges are inclusive', () => {
    const t = createTable(3, 3, { x: 10, y: 20, width: 300, height: 90 });
    expect(hitTestCell(t, { x: 10, y: 20 })).toEqual({ row: 0, col: 0 }); // top-left corner
    expect(hitTestCell(t, { x: 110, y: 20 })).toEqual({ row: 0, col: 1 }); // interior vertical edge
    expect(hitTestCell(t, { x: 50, y: 50 })).toEqual({ row: 1, col: 0 }); // interior horizontal edge
    expect(hitTestCell(t, { x: 310, y: 110 })).toEqual({ row: 2, col: 2 }); // bottom-right corner
  });
});

describe('effectiveCellFill banding', () => {
  const ACCENT = '4472C4';
  const TINT = tintHex(ACCENT, 0.2);

  function solid(fill: Fill): string {
    expect(fill.type).toBe('solid');
    if (fill.type !== 'solid') throw new Error('unreachable');
    expect(fill.color.type).toBe('rgb');
    return fill.color.type === 'rgb' ? fill.color.value : '';
  }

  it('tintHex lightens 20% toward white', () => {
    expect(tintHex('4472C4', 0.2)).toBe('698ED0');
    expect(tintHex('#000000', 0.2)).toBe('333333');
    expect(tintHex('FFFFFF', 0.2)).toBe('FFFFFF');
  });

  it('header row is solid accent when firstRowHeader is on', () => {
    const t = createTable(4, 3);
    expect(solid(effectiveCellFill(t, 0, 0, ACCENT))).toBe(ACCENT);
    expect(solid(effectiveCellFill(t, 0, 2, `#${ACCENT.toLowerCase()}`))).toBe(ACCENT);
  });

  it('banded rows tint odd data rows and leave even ones unfilled', () => {
    const t = createTable(5, 2); // header + 4 data rows
    expect(effectiveCellFill(t, 1, 0, ACCENT)).toEqual({ type: 'none' }); // data row 0
    expect(solid(effectiveCellFill(t, 2, 0, ACCENT))).toBe(TINT); // data row 1
    expect(effectiveCellFill(t, 3, 0, ACCENT)).toEqual({ type: 'none' }); // data row 2
    expect(solid(effectiveCellFill(t, 4, 0, ACCENT))).toBe(TINT); // data row 3
  });

  it('without a header row, banding starts at row 0', () => {
    const t = createTable(3, 2);
    t.firstRowHeader = false;
    expect(effectiveCellFill(t, 0, 0, ACCENT)).toEqual({ type: 'none' });
    expect(solid(effectiveCellFill(t, 1, 0, ACCENT))).toBe(TINT);
    expect(effectiveCellFill(t, 2, 0, ACCENT)).toEqual({ type: 'none' });
  });

  it('banded columns tint odd columns when enabled', () => {
    const t = createTable(2, 4);
    t.firstRowHeader = false;
    t.bandedRows = false;
    t.bandedColumns = true;
    expect(effectiveCellFill(t, 0, 0, ACCENT)).toEqual({ type: 'none' });
    expect(solid(effectiveCellFill(t, 0, 1, ACCENT))).toBe(TINT);
    expect(effectiveCellFill(t, 1, 2, ACCENT)).toEqual({ type: 'none' });
    expect(solid(effectiveCellFill(t, 1, 3, ACCENT))).toBe(TINT);
  });

  it('an explicit cell fill always wins over header and banding', () => {
    const t = createTable(3, 3);
    const red: Fill = { type: 'solid', color: { type: 'rgb', value: 'FF0000' } };
    setCellFill(t, 0, 0, red); // header cell
    setCellFill(t, 2, 1, red); // banded (odd) data row
    expect(effectiveCellFill(t, 0, 0, ACCENT)).toEqual(red);
    expect(effectiveCellFill(t, 2, 1, ACCENT)).toEqual(red);
    expect(solid(effectiveCellFill(t, 2, 0, ACCENT))).toBe(TINT); // neighbor still banded
  });

  it('merged cells use the anchor position for banding decisions', () => {
    const t = createTable(4, 3);
    mergeCells(t, 2, 0, 3, 1); // anchored on odd data row 1
    expect(solid(effectiveCellFill(t, 3, 1, ACCENT))).toBe(TINT);
  });
});
