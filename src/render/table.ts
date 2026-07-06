/**
 * Table element rendering: one rect per visible (non-covered) cell using the
 * src/tables geometry (cellRect) and styling (effectiveCellFill), explicit
 * per-edge borders, and cell text bodies.
 */

import type { LineStyle, Rect, TableCell, TableElement } from '../core/types';
import { cellRect, effectiveCellFill, isCovered } from '../tables';
import type { RenderContext } from './context';
import { fillAttrValue, strokeAttrs, wrapTransform } from './paint';
import { renderTextBody } from './text';
import { fmt } from './xml';

function borderLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: LineStyle,
  ctx: RenderContext,
): string {
  const stroke = strokeAttrs(style, ctx);
  if (stroke === ' stroke="none"') {
    return '';
  }
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"${stroke}/>`;
}

function cellBorders(rect: Rect, cell: TableCell, ctx: RenderContext): string {
  const { x, y, width, height } = rect;
  const out: string[] = [];
  if (cell.borders.top) {
    out.push(borderLine(x, y, x + width, y, cell.borders.top, ctx));
  }
  if (cell.borders.bottom) {
    out.push(borderLine(x, y + height, x + width, y + height, cell.borders.bottom, ctx));
  }
  if (cell.borders.left) {
    out.push(borderLine(x, y, x, y + height, cell.borders.left, ctx));
  }
  if (cell.borders.right) {
    out.push(borderLine(x + width, y, x + width, y + height, cell.borders.right, ctx));
  }
  return out.join('');
}

/** Render a table element (rotation/flips applied via the wrapping group). */
export function renderTable(table: TableElement, ctx: RenderContext): string {
  const accentHex = ctx.scheme.colors[table.styleAccent];
  const rects: string[] = [];
  const borders: string[] = [];
  const texts: string[] = [];

  for (let r = 0; r < table.rows.length; r++) {
    for (let c = 0; c < table.rows[r].cells.length; c++) {
      if (isCovered(table, r, c)) {
        continue;
      }
      const cell = table.rows[r].cells[c];
      const rect = cellRect(table, r, c);
      const fill = fillAttrValue(effectiveCellFill(table, r, c, accentHex), ctx);
      rects.push(
        `<rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}"` +
          ` height="${fmt(rect.height)}" fill="${fill}" class="cell"/>`,
      );
      borders.push(cellBorders(rect, cell, ctx));
      texts.push(renderTextBody(cell.textBody, rect, ctx));
    }
  }
  const content = `<g class="table">${rects.join('')}${borders.join('')}${texts.join('')}</g>`;
  return wrapTransform(table.transform, content);
}
