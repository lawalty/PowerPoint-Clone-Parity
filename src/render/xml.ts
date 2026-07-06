/**
 * XML/SVG string helpers shared by the render and export modules.
 */

/** Escape a string for use in XML text content or attribute values. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a number for an SVG attribute: non-finite values become '0',
 * output is rounded to 2 decimals and never renders as '-0'.
 */
export function fmt(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded === 0 ? 0 : rounded);
}
