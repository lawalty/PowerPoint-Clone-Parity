import { describe, expect, it } from 'vitest';
import {
  createShape,
  findElementById,
  groupElements,
  removeElementById,
  ungroup,
  visitElements,
} from '../../src/shapes';
import type { SlideElement } from '../../src/core/types';

const rect = (x: number, y: number, w: number, h: number) =>
  createShape('rectangle', { x, y, width: w, height: h });

describe('groupElements / ungroup', () => {
  it('group transform is the union bounds; children become group-relative', () => {
    const a = rect(20, 30, 40, 40);
    const b = rect(100, 110, 50, 20);
    const g = groupElements([a, b]);
    expect(g.transform).toMatchObject({ x: 20, y: 30, width: 130, height: 100 });
    expect(g.transform.rotation).toBe(0);
    expect(a.transform.x).toBe(0);
    expect(a.transform.y).toBe(0);
    expect(b.transform.x).toBe(80);
    expect(b.transform.y).toBe(80);
    expect(g.children).toEqual([a, b]);
  });

  it('accounts for rotated children bounds when computing the union', () => {
    const spun = createShape('rectangle', { x: 100, y: 100, width: 100, height: 100, rotation: 45 });
    const g = groupElements([spun]);
    const halfDiag = (100 * Math.SQRT2) / 2;
    expect(g.transform.x).toBeCloseTo(150 - halfDiag, 3);
    expect(g.transform.width).toBeCloseTo(100 * Math.SQRT2, 3);
  });

  it('round-trips: ungroup restores absolute coordinates', () => {
    const a = rect(20, 30, 40, 40);
    const b = rect(100, 110, 50, 20);
    const g = groupElements([a, b]);
    const restored = ungroup(g);
    expect(restored).toHaveLength(2);
    expect(a.transform).toMatchObject({ x: 20, y: 30 });
    expect(b.transform).toMatchObject({ x: 100, y: 110 });
  });

  it('ungroup of a moved group carries the translation to children', () => {
    const a = rect(0, 0, 10, 10);
    const b = rect(40, 0, 10, 10);
    const g = groupElements([a, b]);
    g.transform.x += 100;
    g.transform.y += 50;
    ungroup(g);
    expect(a.transform).toMatchObject({ x: 100, y: 50 });
    expect(b.transform).toMatchObject({ x: 140, y: 50 });
  });

  it('supports nested groups, and nested ungroup restores absolutes', () => {
    const a = rect(20, 30, 40, 40);
    const b = rect(100, 110, 50, 20);
    const c = rect(200, 200, 10, 10);
    const inner = groupElements([a, b]); // (20, 30, 130, 100)
    const outer = groupElements([inner, c]);
    expect(outer.transform).toMatchObject({ x: 20, y: 30, width: 190, height: 180 });
    expect(inner.transform).toMatchObject({ x: 0, y: 0 });
    expect(c.transform).toMatchObject({ x: 180, y: 170 });
    // inner's children remain relative to inner — untouched by the outer grouping
    expect(a.transform).toMatchObject({ x: 0, y: 0 });

    ungroup(outer);
    expect(inner.transform).toMatchObject({ x: 20, y: 30 });
    expect(c.transform).toMatchObject({ x: 200, y: 200 });
    ungroup(inner);
    expect(a.transform).toMatchObject({ x: 20, y: 30 });
    expect(b.transform).toMatchObject({ x: 100, y: 110 });
  });

  it('throws when grouping zero elements', () => {
    expect(() => groupElements([])).toThrow();
  });
});

describe('tree traversal', () => {
  function makeTree() {
    const a = rect(0, 0, 10, 10);
    const b = rect(20, 0, 10, 10);
    const inner = groupElements([a, b]);
    const c = rect(50, 50, 10, 10);
    const outer = groupElements([inner, c]);
    const top = rect(300, 300, 5, 5);
    const elements: SlideElement[] = [outer, top];
    return { a, b, c, inner, outer, top, elements };
  }

  it('findElementById recurses into nested groups', () => {
    const { a, c, inner, outer, top, elements } = makeTree();
    expect(findElementById(elements, a.id)).toBe(a);
    expect(findElementById(elements, c.id)).toBe(c);
    expect(findElementById(elements, inner.id)).toBe(inner);
    expect(findElementById(elements, outer.id)).toBe(outer);
    expect(findElementById(elements, top.id)).toBe(top);
    expect(findElementById(elements, 'nope')).toBeUndefined();
  });

  it('visitElements walks depth-first with parent references', () => {
    const { a, inner, outer, elements } = makeTree();
    const visited: Array<{ id: string; parent: string | null }> = [];
    visitElements(elements, (el, parent) =>
      visited.push({ id: el.id, parent: parent ? parent.id : null }),
    );
    expect(visited).toHaveLength(6);
    expect(visited[0].id).toBe(outer.id);
    expect(visited[0].parent).toBeNull();
    const aEntry = visited.find((v) => v.id === a.id)!;
    expect(aEntry.parent).toBe(inner.id);
  });

  it('removeElementById removes from nested groups and returns the element', () => {
    const { a, inner, elements } = makeTree();
    const removed = removeElementById(elements, a.id);
    expect(removed).toBe(a);
    expect(inner.children).toHaveLength(1);
    expect(findElementById(elements, a.id)).toBeUndefined();
    expect(removeElementById(elements, 'missing')).toBeUndefined();
  });

  it('removeElementById removes a top-level element from the array', () => {
    const { top, elements } = makeTree();
    expect(removeElementById(elements, top.id)).toBe(top);
    expect(elements).toHaveLength(1);
  });
});
