/**
 * Tables engine: creation, structure edits, merging, content, geometry and
 * styling for {@link TableElement}. All operations mutate the given table in
 * place (command/history layers should snapshot via deepClone before calling).
 *
 * Invariants maintained by every structural operation:
 * - `columnWidths.length === rows[r].cells.length` for every row
 * - merge spans never dangle: an anchor's rowSpan/colSpan stay inside the
 *   grid and every covered cell has `merged === true`
 * - `transform.width/height` always equal the sum of column widths / row
 *   heights (see {@link tableSize}).
 */

import type {
  Fill,
  Point,
  Rect,
  Size,
  TableCell,
  TableElement,
  Transform,
} from '../core/types';
import { defaultTextBody, defaultTransform, textBodyOf } from '../core/defaults';
import { genId } from '../core/util';

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

const DEFAULT_COL_WIDTH = 120;
const DEFAULT_ROW_HEIGHT = 32;

/** A fresh, unmerged cell with an empty default text body. */
export function createCell(): TableCell {
  return {
    id: genId('cell'),
    textBody: defaultTextBody(),
    fill: { type: 'none' },
    borders: {},
    rowSpan: 1,
    colSpan: 1,
    merged: false,
  };
}

/**
 * Create a rows x cols table. Column widths evenly divide transform.width and
 * every row gets an equal share of transform.height.
 */
export function createTable(
  rows: number,
  cols: number,
  transform: Partial<Transform> = {},
): TableElement {
  if (!Number.isInteger(rows) || rows < 1) throw new RangeError(`invalid row count: ${rows}`);
  if (!Number.isInteger(cols) || cols < 1) throw new RangeError(`invalid column count: ${cols}`);

  const tf = defaultTransform({
    width: cols * DEFAULT_COL_WIDTH,
    height: rows * DEFAULT_ROW_HEIGHT,
    ...transform,
  });
  const colWidth = tf.width / cols;
  const rowHeight = tf.height / rows;

  return {
    id: genId('table'),
    type: 'table',
    name: 'Table',
    transform: tf,
    hidden: false,
    locked: false,
    rows: Array.from({ length: rows }, () => ({
      height: rowHeight,
      cells: Array.from({ length: cols }, () => createCell()),
    })),
    columnWidths: Array.from({ length: cols }, () => colWidth),
    firstRowHeader: true,
    bandedRows: true,
    bandedColumns: false,
    styleAccent: 'accent1',
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export interface MergeRegion {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

/** All merge regions (anchor cells with a span > 1). */
function mergeRegions(table: TableElement): MergeRegion[] {
  const regions: MergeRegion[] = [];
  table.rows.forEach((row, r) => {
    row.cells.forEach((cell, c) => {
      if (!cell.merged && (cell.rowSpan > 1 || cell.colSpan > 1)) {
        regions.push({ row: r, col: c, rowSpan: cell.rowSpan, colSpan: cell.colSpan });
      }
    });
  });
  return regions;
}

function assertRowIndex(table: TableElement, index: number, allowEnd = false): void {
  const max = table.rows.length - (allowEnd ? 0 : 1);
  if (!Number.isInteger(index) || index < 0 || index > max) {
    throw new RangeError(`row index ${index} out of range 0..${max}`);
  }
}

function assertColIndex(table: TableElement, index: number, allowEnd = false): void {
  const max = table.columnWidths.length - (allowEnd ? 0 : 1);
  if (!Number.isInteger(index) || index < 0 || index > max) {
    throw new RangeError(`column index ${index} out of range 0..${max}`);
  }
}

/** Keep transform size in sync with the grid totals. */
function syncTransform(table: TableElement): void {
  const size = tableSize(table);
  table.transform.width = size.width;
  table.transform.height = size.height;
}

// ---------------------------------------------------------------------------
// Structure operations
// ---------------------------------------------------------------------------

/**
 * Insert a new row before `index` ("insert above" the row currently at
 * `index`; pass rows.length to insert below the last row). Merge spans that
 * cross the insertion point grow to include the new row.
 */
export function insertRow(table: TableElement, index: number): void {
  assertRowIndex(table, index, true);
  const regions = mergeRegions(table);
  const ref = Math.min(index, table.rows.length - 1);
  const height = table.rows[ref].height;
  table.rows.splice(index, 0, {
    height,
    cells: table.columnWidths.map(() => createCell()),
  });
  for (const reg of regions) {
    if (reg.row < index && index < reg.row + reg.rowSpan) {
      // The new row passes through this merged region: absorb it.
      table.rows[reg.row].cells[reg.col].rowSpan += 1;
      for (let c = reg.col; c < reg.col + reg.colSpan; c++) {
        table.rows[index].cells[c].merged = true;
      }
    }
  }
  syncTransform(table);
}

/**
 * Delete the row at `index`. Merge spans crossing the row shrink; a merged
 * region anchored on the deleted row moves its anchor (and content) one row
 * down. Deleting the last remaining row throws.
 */
export function deleteRow(table: TableElement, index: number): void {
  assertRowIndex(table, index);
  if (table.rows.length === 1) throw new Error('cannot delete the last row of a table');
  for (const reg of mergeRegions(table)) {
    if (index < reg.row || index >= reg.row + reg.rowSpan) continue;
    const anchor = table.rows[reg.row].cells[reg.col];
    if (reg.row === index) {
      // Anchor row is being deleted: promote the cell below to anchor.
      const next = table.rows[index + 1].cells[reg.col];
      next.merged = false;
      next.rowSpan = reg.rowSpan - 1;
      next.colSpan = reg.colSpan;
      next.textBody = anchor.textBody;
      next.fill = anchor.fill;
    } else {
      anchor.rowSpan -= 1;
    }
  }
  table.rows.splice(index, 1);
  syncTransform(table);
}

/**
 * Insert a new column before `index` (pass columnWidths.length to append).
 * The new column copies the width of the reference column; merge spans that
 * cross the insertion point grow to include it.
 */
export function insertColumn(table: TableElement, index: number): void {
  assertColIndex(table, index, true);
  const regions = mergeRegions(table);
  const ref = Math.min(index, table.columnWidths.length - 1);
  const width = table.columnWidths[ref];
  table.columnWidths.splice(index, 0, width);
  for (const row of table.rows) row.cells.splice(index, 0, createCell());
  for (const reg of regions) {
    if (reg.col < index && index < reg.col + reg.colSpan) {
      table.rows[reg.row].cells[reg.col].colSpan += 1;
      for (let r = reg.row; r < reg.row + reg.rowSpan; r++) {
        table.rows[r].cells[index].merged = true;
      }
    }
  }
  syncTransform(table);
}

/**
 * Delete the column at `index`. Merge spans crossing the column shrink; a
 * merged region anchored on the deleted column moves its anchor (and content)
 * one column right. Deleting the last remaining column throws.
 */
export function deleteColumn(table: TableElement, index: number): void {
  assertColIndex(table, index);
  if (table.columnWidths.length === 1) {
    throw new Error('cannot delete the last column of a table');
  }
  for (const reg of mergeRegions(table)) {
    if (index < reg.col || index >= reg.col + reg.colSpan) continue;
    const anchor = table.rows[reg.row].cells[reg.col];
    if (reg.col === index) {
      const next = table.rows[reg.row].cells[index + 1];
      next.merged = false;
      next.colSpan = reg.colSpan - 1;
      next.rowSpan = reg.rowSpan;
      next.textBody = anchor.textBody;
      next.fill = anchor.fill;
    } else {
      anchor.colSpan -= 1;
    }
  }
  table.columnWidths.splice(index, 1);
  for (const row of table.rows) row.cells.splice(index, 1);
  syncTransform(table);
}

export function resizeRow(table: TableElement, index: number, height: number): void {
  assertRowIndex(table, index);
  if (!(height > 0) || !Number.isFinite(height)) {
    throw new RangeError(`invalid row height: ${height}`);
  }
  table.rows[index].height = height;
  syncTransform(table);
}

export function resizeColumn(table: TableElement, index: number, width: number): void {
  assertColIndex(table, index);
  if (!(width > 0) || !Number.isFinite(width)) {
    throw new RangeError(`invalid column width: ${width}`);
  }
  table.columnWidths[index] = width;
  syncTransform(table);
}

/** Equalize all row heights, preserving the total table height. */
export function distributeRows(table: TableElement): void {
  const total = table.rows.reduce((sum, r) => sum + r.height, 0);
  const each = total / table.rows.length;
  for (const row of table.rows) row.height = each;
  syncTransform(table);
}

/** Equalize all column widths, preserving the total table width. */
export function distributeColumns(table: TableElement): void {
  const total = table.columnWidths.reduce((sum, w) => sum + w, 0);
  const each = total / table.columnWidths.length;
  for (let c = 0; c < table.columnWidths.length; c++) table.columnWidths[c] = each;
  syncTransform(table);
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

/**
 * Merge the rectangular range (r1,c1)..(r2,c2) (inclusive, any corner order).
 * The top-left cell becomes the anchor carrying rowSpan/colSpan; every other
 * cell in the range is marked `merged` and its text is cleared. Existing
 * merges fully inside the range are absorbed; a merge that only partially
 * overlaps the range throws.
 */
export function mergeCells(
  table: TableElement,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): void {
  assertRowIndex(table, r1);
  assertRowIndex(table, r2);
  assertColIndex(table, c1);
  assertColIndex(table, c2);
  const rowA = Math.min(r1, r2);
  const rowB = Math.max(r1, r2);
  const colA = Math.min(c1, c2);
  const colB = Math.max(c1, c2);

  for (const reg of mergeRegions(table)) {
    const intersects =
      reg.row <= rowB &&
      rowA <= reg.row + reg.rowSpan - 1 &&
      reg.col <= colB &&
      colA <= reg.col + reg.colSpan - 1;
    if (!intersects) continue;
    const contained =
      reg.row >= rowA &&
      reg.row + reg.rowSpan - 1 <= rowB &&
      reg.col >= colA &&
      reg.col + reg.colSpan - 1 <= colB;
    if (!contained) {
      throw new Error('merge range partially overlaps an existing merged region');
    }
  }

  for (let r = rowA; r <= rowB; r++) {
    for (let c = colA; c <= colB; c++) {
      const cell = table.rows[r].cells[c];
      if (r === rowA && c === colA) {
        cell.rowSpan = rowB - rowA + 1;
        cell.colSpan = colB - colA + 1;
        cell.merged = false;
      } else {
        cell.rowSpan = 1;
        cell.colSpan = 1;
        cell.merged = true;
        cell.textBody = defaultTextBody();
      }
    }
  }
}

/** Split the merged region containing (r,c) back into individual cells. */
export function splitCell(table: TableElement, r: number, c: number): void {
  const anchor = anchorOf(table, r, c);
  const { rowSpan, colSpan } = anchor.cell;
  for (let rr = anchor.row; rr < anchor.row + rowSpan; rr++) {
    for (let cc = anchor.col; cc < anchor.col + colSpan; cc++) {
      const cell = table.rows[rr].cells[cc];
      cell.rowSpan = 1;
      cell.colSpan = 1;
      cell.merged = false;
    }
  }
}

/** The cell stored at grid position (r,c); throws on out-of-range indices. */
export function getCellAt(table: TableElement, r: number, c: number): TableCell {
  assertRowIndex(table, r);
  assertColIndex(table, c);
  return table.rows[r].cells[c];
}

export interface CellAddress {
  row: number;
  col: number;
  cell: TableCell;
}

/**
 * Resolve (r,c) to the anchor of its merged region. For a normal (or anchor)
 * cell this is the cell itself.
 */
export function anchorOf(table: TableElement, r: number, c: number): CellAddress {
  const cell = getCellAt(table, r, c);
  if (!cell.merged) return { row: r, col: c, cell };
  for (const reg of mergeRegions(table)) {
    if (
      r >= reg.row &&
      r < reg.row + reg.rowSpan &&
      c >= reg.col &&
      c < reg.col + reg.colSpan
    ) {
      return { row: reg.row, col: reg.col, cell: table.rows[reg.row].cells[reg.col] };
    }
  }
  // Inconsistent model (covered cell without an owning region); self-heal.
  cell.merged = false;
  return { row: r, col: c, cell };
}

/** True when (r,c) is covered by a merge (i.e. not an anchor, not normal). */
export function isCovered(table: TableElement, r: number, c: number): boolean {
  return getCellAt(table, r, c).merged;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Replace the cell's text with a single plain paragraph. Resolves merges. */
export function setCellText(table: TableElement, r: number, c: number, text: string): void {
  anchorOf(table, r, c).cell.textBody = textBodyOf(text);
}

/** Plain text of the cell (paragraphs joined by \n). Resolves merges. */
export function getCellText(table: TableElement, r: number, c: number): string {
  const { cell } = anchorOf(table, r, c);
  return cell.textBody.paragraphs
    .map((p) =>
      p.children.map((child) => (child.type === 'run' ? child.text : '\n')).join(''),
    )
    .join('\n');
}

/** Set an explicit cell fill (overrides banding). Resolves merges. */
export function setCellFill(table: TableElement, r: number, c: number, fill: Fill): void {
  anchorOf(table, r, c).cell.fill = fill;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Total grid size (sum of column widths x sum of row heights). */
export function tableSize(table: TableElement): Size {
  return {
    width: table.columnWidths.reduce((sum, w) => sum + w, 0),
    height: table.rows.reduce((sum, r) => sum + r.height, 0),
  };
}

/** Slide-space y of the top edge of row `row` (row may equal rows.length). */
export function rowY(table: TableElement, row: number): number {
  assertRowIndex(table, row, true);
  let y = table.transform.y;
  for (let r = 0; r < row; r++) y += table.rows[r].height;
  return y;
}

/** Slide-space x of the left edge of column `col` (col may equal count). */
export function colX(table: TableElement, col: number): number {
  assertColIndex(table, col, true);
  let x = table.transform.x;
  for (let c = 0; c < col; c++) x += table.columnWidths[c];
  return x;
}

/**
 * Slide-space rectangle of the cell at (r,c). Covered cells resolve to their
 * anchor, and the rect spans the full merged region.
 */
export function cellRect(table: TableElement, r: number, c: number): Rect {
  const anchor = anchorOf(table, r, c);
  const x = colX(table, anchor.col);
  const y = rowY(table, anchor.row);
  let width = 0;
  for (let cc = anchor.col; cc < anchor.col + anchor.cell.colSpan; cc++) {
    width += table.columnWidths[cc];
  }
  let height = 0;
  for (let rr = anchor.row; rr < anchor.row + anchor.cell.rowSpan; rr++) {
    height += table.rows[rr].height;
  }
  return { x, y, width, height };
}

function indexAt(offset: number, sizes: number[]): number {
  let acc = 0;
  for (let i = 0; i < sizes.length; i++) {
    acc += sizes[i];
    if (offset < acc) return i;
  }
  return sizes.length - 1; // exactly on the far edge
}

/**
 * Grid position under a slide-space point, or null when outside the table.
 * Points on an interior boundary belong to the cell after the boundary; the
 * far right/bottom edges are inclusive. Rotation is not considered.
 */
export function hitTestCell(
  table: TableElement,
  point: Point,
): { row: number; col: number } | null {
  const size = tableSize(table);
  const dx = point.x - table.transform.x;
  const dy = point.y - table.transform.y;
  if (dx < 0 || dy < 0 || dx > size.width || dy > size.height) return null;
  return {
    row: indexAt(
      dy,
      table.rows.map((r) => r.height),
    ),
    col: indexAt(dx, table.columnWidths),
  };
}

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

/** Lighten a hex color toward white by `tint` (0..1). Returns uppercase hex. */
export function tintHex(hex: string, tint: number): string {
  const clean = hex.replace(/^#/, '');
  const n = parseInt(clean, 16);
  const channel = (shift: number): string => {
    const v = (n >> shift) & 0xff;
    return Math.round(v + (255 - v) * tint)
      .toString(16)
      .padStart(2, '0');
  };
  return `${channel(16)}${channel(8)}${channel(0)}`.toUpperCase();
}

const BAND_TINT = 0.2;

function solidHex(value: string): Fill {
  return { type: 'solid', color: { type: 'rgb', value } };
}

/**
 * PowerPoint-style effective fill for the cell at (r,c):
 * - an explicit (non-'none') cell fill always wins,
 * - the header row is solid accent when firstRowHeader is on,
 * - banded rows paint odd data rows (0-based, below the header) with a 20%
 *   tint of the accent,
 * - banded columns do the same for odd columns,
 * - otherwise 'none'.
 */
export function effectiveCellFill(
  table: TableElement,
  r: number,
  c: number,
  accentHex: string,
): Fill {
  const anchor = anchorOf(table, r, c);
  if (anchor.cell.fill.type !== 'none') return anchor.cell.fill;

  const accent = accentHex.replace(/^#/, '').toUpperCase();
  if (table.firstRowHeader && anchor.row === 0) return solidHex(accent);
  if (table.bandedRows) {
    const dataIndex = table.firstRowHeader ? anchor.row - 1 : anchor.row;
    if (dataIndex % 2 === 1) return solidHex(tintHex(accent, BAND_TINT));
  }
  if (table.bandedColumns && anchor.col % 2 === 1) {
    return solidHex(tintHex(accent, BAND_TINT));
  }
  return { type: 'none' };
}
