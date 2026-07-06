/** Shared utilities used across all modules. */

let counter = 0;

/** Generate a unique, deterministic-per-session id with an optional prefix. */
export function genId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}-${(counter * 2654435761 % 0xffffff).toString(16)}`;
}

/** Reset the id counter (tests only). */
export function resetIds(): void {
  counter = 0;
}

/** Deep-clone plain serializable data. */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Round to a sensible precision to avoid float noise in geometry math. */
export function round(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
