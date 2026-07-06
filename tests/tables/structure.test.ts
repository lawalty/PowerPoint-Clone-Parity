import { describe, expect, it } from 'vitest';
import {
  createTable,
  insertRow,
  deleteRow,
  insertColumn,
  deleteColumn,
  resizeRow,
  resizeColumn,
  distributeRows,
  distributeColumns,
  tableSize,
  getCellAt,
} from '../../src/tables';

describe('createTable', () => {
  it('builds an evenly divided grid matching the transform', () => {
    const t = createTable(3, 4, { x: 10, y: 20, width: 400, height: 120 });
    expect(t.type).toBe('table');
    expect(t.rows).toHaveLength(3);
    expect(t.columnWidths).toEqual([100, 100, 100, 100]);
    expect(t.rows.map((r) => r.height)).toEqual([40, 40, 40]);
    expect(t.columnWidths.reduce((a, b) => a + b, 0)).toBeCloseTo(t.transform.width, 9);
    expect(t.rows.reduce((a, r) => a + r.height, 0)).toBeCloseTo(t.transform.height, 9);
    expect(t.rows.every((r) => r.cells.length === 4)).toBe(true);
  });

  it('sets default style flags and pristine cells', () => {
    const t = createTable(2, 2);
    expect(t.firstRowHeader).toBe(true);
    expect(t.bandedRows).toBe(true);
    expect(t.bandedColumns).toBe(false);
    expect(t.styleAccent).toBe('accent1');
    const cell = getCellAt(t, 0, 0);
    expect(cell.rowSpan).toBe(1);
    expect(cell.colSpan).toBe(1);
    expect(cell.merged).toBe(false);
    expect(cell.fill).toEqual({ type: 'none' });
    expect(cell.textBody.paragraphs).toHaveLength(1);
    // Distinct cell ids
    const ids = t.rows.flatMap((r) => r.cells.map((c) => c.id));
    expect(new Set(ids).size).toBe(4);
  });

  it('divides odd widths evenly (sums preserved despite float division)', () => {
    const t = createTable(2, 3, { width: 400, height: 100 });
    expect(t.columnWidths).toHaveLength(3);
    expect(t.columnWidths[0]).toBeCloseTo(400 / 3, 9);
    expect(t.columnWidths.reduce((a, b) => a + b, 0)).toBeCloseTo(400, 9);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => createTable(0, 3)).toThrow();
    expect(() => createTable(3, -1)).toThrow();
  });
});

describe('insert/delete rows and columns', () => {
  it('insertRow keeps every row consistent and copies the reference height', () => {
    const t = createTable(2, 3, { width: 300, height: 80 });
    resizeRow(t, 1, 60);
    insertRow(t, 1);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[1].height).toBe(60); // copied from the row pushed down
    expect(t.rows.every((r) => r.cells.length === 3)).toBe(true);
    expect(t.transform.height).toBeCloseTo(40 + 60 + 60, 9);
  });

  it('insertRow at rows.length appends below the last row', () => {
    const t = createTable(2, 2, { width: 200, height: 80 });
    insertRow(t, 2);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[2].height).toBe(40);
  });

  it('deleteRow removes the row and updates the transform', () => {
    const t = createTable(3, 2, { width: 200, height: 120 });
    deleteRow(t, 1);
    expect(t.rows).toHaveLength(2);
    expect(t.transform.height).toBeCloseTo(80, 9);
  });

  it('throws when deleting the last row or column', () => {
    const t = createTable(1, 1);
    expect(() => deleteRow(t, 0)).toThrow(/last row/);
    expect(() => deleteColumn(t, 0)).toThrow(/last column/);
  });

  it('throws on out-of-range indices', () => {
    const t = createTable(2, 2);
    expect(() => insertRow(t, 3)).toThrow(RangeError);
    expect(() => insertRow(t, -1)).toThrow(RangeError);
    expect(() => deleteRow(t, 2)).toThrow(RangeError);
    expect(() => insertColumn(t, 5)).toThrow(RangeError);
    expect(() => deleteColumn(t, 2)).toThrow(RangeError);
  });

  it('insertColumn adds a cell to every row and a width entry', () => {
    const t = createTable(2, 2, { width: 200, height: 80 });
    resizeColumn(t, 1, 150);
    insertColumn(t, 1);
    expect(t.columnWidths).toEqual([100, 150, 150]);
    expect(t.rows.every((r) => r.cells.length === 3)).toBe(true);
    expect(t.transform.width).toBeCloseTo(400, 9);
  });

  it('deleteColumn removes cells and width', () => {
    const t = createTable(2, 3, { width: 300, height: 80 });
    deleteColumn(t, 0);
    expect(t.columnWidths).toEqual([100, 100]);
    expect(t.rows.every((r) => r.cells.length === 2)).toBe(true);
    expect(t.transform.width).toBeCloseTo(200, 9);
  });
});

describe('resize and distribute', () => {
  it('resizeRow / resizeColumn set sizes and sync the transform', () => {
    const t = createTable(2, 2, { width: 200, height: 80 });
    resizeRow(t, 0, 100);
    resizeColumn(t, 1, 25);
    expect(t.rows[0].height).toBe(100);
    expect(t.columnWidths[1]).toBe(25);
    expect(tableSize(t)).toEqual({ width: 125, height: 140 });
    expect(t.transform.width).toBe(125);
    expect(t.transform.height).toBe(140);
  });

  it('rejects non-positive sizes', () => {
    const t = createTable(2, 2);
    expect(() => resizeRow(t, 0, 0)).toThrow(RangeError);
    expect(() => resizeColumn(t, 0, -5)).toThrow(RangeError);
  });

  it('distributeRows equalizes heights preserving the total', () => {
    const t = createTable(3, 2, { width: 200, height: 120 });
    resizeRow(t, 0, 10);
    resizeRow(t, 1, 20);
    resizeRow(t, 2, 60);
    distributeRows(t);
    expect(t.rows.map((r) => r.height)).toEqual([30, 30, 30]);
    expect(t.transform.height).toBeCloseTo(90, 9);
  });

  it('distributeColumns equalizes widths preserving the total', () => {
    const t = createTable(2, 4, { width: 400, height: 80 });
    resizeColumn(t, 0, 10);
    resizeColumn(t, 3, 250);
    distributeColumns(t);
    const total = 10 + 100 + 100 + 250;
    expect(t.columnWidths).toEqual([total / 4, total / 4, total / 4, total / 4]);
    expect(t.transform.width).toBeCloseTo(total, 9);
  });
});
