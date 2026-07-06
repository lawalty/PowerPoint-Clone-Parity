import { describe, expect, it } from 'vitest';
import {
  createTable,
  mergeCells,
  splitCell,
  getCellAt,
  anchorOf,
  isCovered,
  insertRow,
  deleteRow,
  insertColumn,
  deleteColumn,
  setCellText,
  getCellText,
} from '../../src/tables';

function merged2x2() {
  const t = createTable(3, 3, { x: 0, y: 0, width: 300, height: 90 });
  mergeCells(t, 0, 0, 1, 1);
  return t;
}

describe('mergeCells / splitCell', () => {
  it('marks the anchor with spans and covers the rest with empty text', () => {
    const t = merged2x2();
    const anchor = getCellAt(t, 0, 0);
    expect(anchor.rowSpan).toBe(2);
    expect(anchor.colSpan).toBe(2);
    expect(anchor.merged).toBe(false);
    for (const [r, c] of [
      [0, 1],
      [1, 0],
      [1, 1],
    ] as const) {
      expect(isCovered(t, r, c)).toBe(true);
      expect(getCellAt(t, r, c).rowSpan).toBe(1);
      expect(getCellAt(t, r, c).colSpan).toBe(1);
    }
    expect(isCovered(t, 2, 2)).toBe(false);
  });

  it('accepts corners in any order and clears covered text', () => {
    const t = createTable(3, 3);
    setCellText(t, 2, 2, 'bye');
    mergeCells(t, 2, 2, 1, 1); // reversed corners
    expect(getCellAt(t, 1, 1).rowSpan).toBe(2);
    expect(getCellAt(t, 1, 1).colSpan).toBe(2);
    expect(isCovered(t, 2, 2)).toBe(true);
    // covered cell's own textBody was reset to empty
    expect(t.rows[2].cells[2].textBody.paragraphs[0].children).toHaveLength(0);
  });

  it('rejects a range that partially overlaps an existing merge', () => {
    const t = merged2x2();
    expect(() => mergeCells(t, 1, 1, 2, 2)).toThrow(/partially overlaps/);
    expect(() => mergeCells(t, 0, 1, 0, 2)).toThrow(/partially overlaps/);
    // untouched by the failed merges
    expect(getCellAt(t, 0, 0).rowSpan).toBe(2);
    expect(isCovered(t, 0, 2)).toBe(false);
  });

  it('absorbs a merge fully contained in the new range', () => {
    const t = merged2x2();
    mergeCells(t, 0, 0, 2, 2);
    expect(getCellAt(t, 0, 0).rowSpan).toBe(3);
    expect(getCellAt(t, 0, 0).colSpan).toBe(3);
    expect(isCovered(t, 2, 2)).toBe(true);
    expect(isCovered(t, 1, 1)).toBe(true);
  });

  it('splitCell resets spans and un-marks covered cells, from any covered cell', () => {
    const t = merged2x2();
    splitCell(t, 1, 1); // covered cell, not the anchor
    expect(getCellAt(t, 0, 0).rowSpan).toBe(1);
    expect(getCellAt(t, 0, 0).colSpan).toBe(1);
    expect(isCovered(t, 0, 1)).toBe(false);
    expect(isCovered(t, 1, 0)).toBe(false);
    expect(isCovered(t, 1, 1)).toBe(false);
  });

  it('anchorOf resolves covered cells to the anchor and is identity elsewhere', () => {
    const t = merged2x2();
    expect(anchorOf(t, 1, 1)).toMatchObject({ row: 0, col: 0 });
    expect(anchorOf(t, 0, 1).cell).toBe(getCellAt(t, 0, 0));
    expect(anchorOf(t, 2, 2)).toMatchObject({ row: 2, col: 2 });
    expect(() => getCellAt(t, 3, 0)).toThrow(RangeError);
  });

  it('setCellText / getCellText route through the anchor', () => {
    const t = merged2x2();
    setCellText(t, 0, 0, 'hello');
    expect(getCellText(t, 0, 0)).toBe('hello');
    expect(getCellText(t, 1, 1)).toBe('hello'); // covered resolves to anchor
    setCellText(t, 1, 0, 'world'); // covered cell writes to the anchor too
    expect(getCellText(t, 0, 0)).toBe('world');
  });
});

describe('structure edits through merged regions', () => {
  it('deleteColumn through a 2x2 merge shrinks the span', () => {
    const t = merged2x2();
    deleteColumn(t, 1); // cuts through the merge
    expect(t.columnWidths).toHaveLength(2);
    const anchor = getCellAt(t, 0, 0);
    expect(anchor.rowSpan).toBe(2);
    expect(anchor.colSpan).toBe(1);
    expect(isCovered(t, 1, 0)).toBe(true); // still covered vertically
    expect(isCovered(t, 0, 1)).toBe(false); // former col 2 is normal
  });

  it('deleteColumn on the anchor column promotes the next column', () => {
    const t = merged2x2();
    setCellText(t, 0, 0, 'keep');
    deleteColumn(t, 0);
    const promoted = getCellAt(t, 0, 0); // was (0,1)
    expect(promoted.merged).toBe(false);
    expect(promoted.rowSpan).toBe(2);
    expect(promoted.colSpan).toBe(1);
    expect(getCellText(t, 0, 0)).toBe('keep'); // content moved with the anchor
    expect(isCovered(t, 1, 0)).toBe(true);
  });

  it('deleteRow through a 2x2 merge shrinks the span', () => {
    const t = merged2x2();
    deleteRow(t, 1);
    const anchor = getCellAt(t, 0, 0);
    expect(anchor.rowSpan).toBe(1);
    expect(anchor.colSpan).toBe(2);
    expect(isCovered(t, 0, 1)).toBe(true);
    expect(isCovered(t, 1, 0)).toBe(false);
  });

  it('deleteRow on the anchor row promotes the row below', () => {
    const t = merged2x2();
    setCellText(t, 0, 0, 'keep');
    deleteRow(t, 0);
    const promoted = getCellAt(t, 0, 0); // was (1,0)
    expect(promoted.merged).toBe(false);
    expect(promoted.rowSpan).toBe(1);
    expect(promoted.colSpan).toBe(2);
    expect(getCellText(t, 0, 0)).toBe('keep');
    expect(isCovered(t, 0, 1)).toBe(true);
  });

  it('insertRow inside a merge grows the span and covers the new cells', () => {
    const t = merged2x2();
    insertRow(t, 1);
    expect(t.rows).toHaveLength(4);
    const anchor = getCellAt(t, 0, 0);
    expect(anchor.rowSpan).toBe(3);
    expect(isCovered(t, 1, 0)).toBe(true);
    expect(isCovered(t, 1, 1)).toBe(true);
    expect(isCovered(t, 1, 2)).toBe(false); // outside the merge
  });

  it('insertRow at a merge boundary does not grow the span', () => {
    const t = merged2x2();
    insertRow(t, 0); // above the merge
    expect(getCellAt(t, 1, 0).rowSpan).toBe(2);
    expect(isCovered(t, 0, 0)).toBe(false);
    insertRow(t, 3); // below the merge (merge now occupies rows 1-2)
    expect(getCellAt(t, 1, 0).rowSpan).toBe(2);
    expect(isCovered(t, 3, 0)).toBe(false);
  });

  it('insertColumn inside a merge grows the span and covers the new cells', () => {
    const t = merged2x2();
    insertColumn(t, 1);
    expect(t.columnWidths).toHaveLength(4);
    const anchor = getCellAt(t, 0, 0);
    expect(anchor.colSpan).toBe(3);
    expect(isCovered(t, 0, 1)).toBe(true);
    expect(isCovered(t, 1, 1)).toBe(true);
    expect(isCovered(t, 2, 1)).toBe(false); // row 2 is outside the merge
  });
});
