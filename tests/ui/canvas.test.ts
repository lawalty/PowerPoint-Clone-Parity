// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState, Canvas } from '../../src/ui';
import { createPresentation } from '../../src/model';
import { createShape, groupElements } from '../../src/shapes';
import type { ShapeElement } from '../../src/core/types';

function stubRect(el: HTMLElement): void {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 960,
      bottom: 540,
      width: 960,
      height: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

function mouse(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  opts: { shiftKey?: boolean } = {},
): void {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, ...opts }),
  );
}

interface Setup {
  state: EditorState;
  canvas: Canvas;
  a: ShapeElement;
  b: ShapeElement;
  c: ShapeElement;
}

let host: HTMLElement;
let active: Canvas | null = null;

function setup(): Setup {
  const pres = createPresentation();
  const slide = pres.slides[0];
  slide.elements.splice(0); // start from a blank slide
  const a = createShape('rectangle', { x: 10, y: 10, width: 50, height: 50 });
  const b = createShape('ellipse', { x: 100, y: 10, width: 50, height: 50 });
  const c = createShape('diamond', { x: 300, y: 300, width: 50, height: 50 });
  slide.elements.push(a, b, c);
  const state = new EditorState(pres);
  const canvas = new Canvas(host, state);
  stubRect(canvas.el);
  active = canvas;
  return { state, canvas, a, b, c };
}

/** Look an element up by id after undo/redo (undo replaces object identity). */
function find(state: EditorState, id: string): ShapeElement {
  return state.currentSlide()!.elements.find((e) => e.id === id) as ShapeElement;
}

function elementDiv(canvas: Canvas, id: string): HTMLElement {
  const div = canvas.el.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null;
  if (!div) throw new Error(`element div not found: ${id}`);
  return div;
}

beforeEach(() => {
  host = document.createElement('div');
});

afterEach(() => {
  active?.destroy();
  active = null;
});

describe('Canvas: rendering & selection', () => {
  it('renders one div per element with slide-sized root', () => {
    const { canvas } = setup();
    expect(canvas.el.querySelectorAll('[data-element-id]').length).toBe(3);
    expect(canvas.el.style.width).toBe('960px');
    expect(canvas.el.style.height).toBe('540px');
  });

  it('renders 8 resize handles plus a rotate handle on the selected element', () => {
    const { state, canvas, a } = setup();
    state.selectElements([a.id]);
    const div = elementDiv(canvas, a.id);
    expect(div.classList.contains('selected')).toBe(true);
    expect(div.querySelectorAll('.resize-handle').length).toBe(8);
    expect(div.querySelectorAll('.rotate-handle').length).toBe(1);
  });

  it('click selects an element; click on empty canvas clears', () => {
    const { state, canvas, a } = setup();
    mouse(elementDiv(canvas, a.id), 'mousedown', 20, 20);
    mouse(canvas.el, 'mouseup', 20, 20);
    expect(state.selection.elementIds).toEqual([a.id]);
    mouse(canvas.el, 'mousedown', 500, 500);
    mouse(canvas.el, 'mouseup', 500, 500);
    expect(state.selection.elementIds).toEqual([]);
  });

  it('shift-click toggles elements in and out of the selection', () => {
    const { state, canvas, a, b } = setup();
    mouse(elementDiv(canvas, a.id), 'mousedown', 20, 20);
    mouse(canvas.el, 'mouseup', 20, 20);
    mouse(elementDiv(canvas, b.id), 'mousedown', 110, 20, { shiftKey: true });
    mouse(canvas.el, 'mouseup', 110, 20, { shiftKey: true });
    expect(state.selection.elementIds).toEqual([a.id, b.id]);
    mouse(elementDiv(canvas, b.id), 'mousedown', 110, 20, { shiftKey: true });
    mouse(canvas.el, 'mouseup', 110, 20, { shiftKey: true });
    expect(state.selection.elementIds).toEqual([a.id]);
  });

  it('clicking a group child selects the top-level group', () => {
    const { state, canvas } = setup();
    const slide = state.currentSlide()!;
    const g1 = createShape('rectangle', { x: 400, y: 40, width: 40, height: 40 });
    const g2 = createShape('rectangle', { x: 460, y: 40, width: 40, height: 40 });
    const group = groupElements([g1, g2]);
    slide.elements.push(group);
    canvas.render();
    mouse(elementDiv(canvas, g1.id), 'mousedown', 410, 50);
    mouse(canvas.el, 'mouseup', 410, 50);
    expect(state.selection.elementIds).toEqual([group.id]);
  });

  it('marquee drag selects two of three elements', () => {
    const { state, canvas, a, b } = setup();
    mouse(canvas.el, 'mousedown', 0, 0);
    mouse(canvas.el, 'mousemove', 200, 100);
    expect(canvas.el.querySelector('.marquee')).not.toBeNull();
    mouse(canvas.el, 'mouseup', 200, 100);
    expect(state.selection.elementIds.sort()).toEqual([a.id, b.id].sort());
    expect(canvas.el.querySelector('.marquee')).toBeNull();
  });
});

describe('Canvas: dragging', () => {
  it('drag moves the selected element and commits one undo step', () => {
    const { state, canvas, a } = setup();
    const undoDepthBefore = state.canUndo;
    mouse(elementDiv(canvas, a.id), 'mousedown', 20, 20);
    mouse(canvas.el, 'mousemove', 35, 55);
    expect(a.transform.x).toBe(25); // live preview
    mouse(canvas.el, 'mouseup', 35, 55);
    expect(a.transform.x).toBe(25);
    expect(a.transform.y).toBe(45);
    expect(undoDepthBefore).toBe(false);
    state.undo();
    expect(find(state, a.id).transform.x).toBe(10);
    expect(find(state, a.id).transform.y).toBe(10);
    expect(state.canUndo).toBe(false); // the whole drag was one step
  });

  it('drag snaps to the grid when gridSize is set', () => {
    const { state, canvas, a } = setup();
    canvas.gridSize = 10;
    mouse(elementDiv(canvas, a.id), 'mousedown', 20, 20);
    mouse(canvas.el, 'mousemove', 33, 37);
    mouse(canvas.el, 'mouseup', 33, 37);
    // orig (10,10) + delta (13,17) = (23,27) -> snapped to (20,30)
    expect(a.transform.x).toBe(20);
    expect(a.transform.y).toBe(30);
    state.undo();
    expect(find(state, a.id).transform.x).toBe(10);
  });

  it('multi-selection drag moves all selected elements together', () => {
    const { state, canvas, a, b } = setup();
    state.selectElements([a.id, b.id]);
    mouse(elementDiv(canvas, a.id), 'mousedown', 20, 20);
    mouse(canvas.el, 'mousemove', 30, 25);
    mouse(canvas.el, 'mouseup', 30, 25);
    expect(a.transform.x).toBe(20);
    expect(b.transform.x).toBe(110);
    expect(b.transform.y).toBe(15);
  });

  it('handle drag resizes the element about the opposite anchor', () => {
    const { state, canvas, b } = setup();
    state.selectElements([b.id]);
    const handle = elementDiv(canvas, b.id).querySelector(
      '[data-handle="bottomRight"]',
    ) as HTMLElement;
    mouse(handle, 'mousedown', 150, 60);
    mouse(canvas.el, 'mousemove', 170, 70);
    mouse(canvas.el, 'mouseup', 170, 70);
    expect(b.transform.width).toBe(70);
    expect(b.transform.height).toBe(60);
    expect(b.transform.x).toBe(100); // anchored at topLeft
    expect(b.transform.y).toBe(10);
    state.undo();
    expect(find(state, b.id).transform.width).toBe(50);
  });

  it('rotate handle drag sets rotation from the pointer angle', () => {
    const { state, canvas, a } = setup();
    state.selectElements([a.id]);
    const handle = elementDiv(canvas, a.id).querySelector('.rotate-handle') as HTMLElement;
    // center of a = (35, 35); pointer due east => 90 degrees.
    mouse(handle, 'mousedown', 35, 5);
    mouse(canvas.el, 'mousemove', 85, 35);
    mouse(canvas.el, 'mouseup', 85, 35);
    expect(a.transform.rotation).toBeCloseTo(90);
    state.undo();
    expect(find(state, a.id).transform.rotation).toBe(0);
  });

  it('zoom scales pointer math back to slide coordinates', () => {
    const { state, canvas, a } = setup();
    state.setZoom(2);
    stubRect(canvas.el);
    mouse(elementDiv(canvas, a.id), 'mousedown', 40, 40); // slide point (20,20)
    mouse(canvas.el, 'mousemove', 60, 40); // slide point (30,20): dx=10
    mouse(canvas.el, 'mouseup', 60, 40);
    expect(a.transform.x).toBe(20);
    expect(a.transform.y).toBe(10);
  });
});

describe('Canvas: keyboard', () => {
  it('Delete removes the selection', () => {
    const { state, canvas, a } = setup();
    state.selectElements([a.id]);
    canvas.el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
    );
    expect(state.currentSlide()!.elements.some((e) => e.id === a.id)).toBe(false);
  });

  it('Escape clears the selection, or cancels an in-flight drag first', () => {
    const { state, canvas, a } = setup();
    mouse(elementDiv(canvas, a.id), 'mousedown', 20, 20);
    mouse(canvas.el, 'mousemove', 60, 60);
    expect(a.transform.x).toBe(50);
    canvas.el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(a.transform.x).toBe(10); // drag reverted, nothing committed
    expect(state.canUndo).toBe(false);
    expect(state.selection.elementIds).toEqual([a.id]);
    canvas.el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(state.selection.elementIds).toEqual([]);
  });
});
