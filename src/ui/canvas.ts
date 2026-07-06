/**
 * Editor canvas: renders the current slide's elements as absolutely
 * positioned <div>s (data-element-id) and implements mouse interactions:
 *
 *  - click selects (shift-click adds), click on empty canvas clears
 *  - dragging selected elements moves them (ONE undo step, committed on mouseup)
 *  - dragging a resize handle resizes (ONE undo step)
 *  - dragging on empty canvas draws a marquee and selects elementsInRect
 *
 * Coordinates: zoom 1 maps 1pt to 1px; slide point = (client - rect) / zoom.
 */

import type { Id, Point, SlideElement, Transform } from '../core/types';
import { radToDeg } from '../core/util';
import {
  elementsInRect,
  findElementById,
  normalizeAngle,
  resizeElement,
  snapValue,
  type ResizeAnchor,
} from '../shapes';
import type { EditorState } from './state';
import { applyTransformStyles, renderElementDiv, schemeForSlide } from './element-dom';

export const HANDLE_NAMES = [
  'topLeft',
  'top',
  'topRight',
  'left',
  'right',
  'bottomLeft',
  'bottom',
  'bottomRight',
] as const;

export type HandleName = (typeof HANDLE_NAMES)[number];

const HANDLE_ANCHOR: Record<HandleName, ResizeAnchor> = {
  topLeft: 'bottomRight',
  top: 'bottom',
  topRight: 'bottomLeft',
  left: 'right',
  right: 'left',
  bottomLeft: 'topRight',
  bottom: 'top',
  bottomRight: 'topLeft',
};

function sizeForHandle(
  handle: HandleName,
  orig: Transform,
  dx: number,
  dy: number,
): { width: number; height: number } {
  let width = orig.width;
  let height = orig.height;
  if (handle === 'left' || handle === 'topLeft' || handle === 'bottomLeft') width -= dx;
  if (handle === 'right' || handle === 'topRight' || handle === 'bottomRight') width += dx;
  if (handle === 'top' || handle === 'topLeft' || handle === 'topRight') height -= dy;
  if (handle === 'bottom' || handle === 'bottomLeft' || handle === 'bottomRight') height += dy;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

interface MoveInteraction {
  kind: 'move';
  start: Point;
  last: Point;
  originals: Map<Id, { x: number; y: number }>;
}

interface ResizeInteraction {
  kind: 'resize';
  start: Point;
  last: Point;
  elementId: Id;
  handle: HandleName;
  original: Transform;
}

interface MarqueeInteraction {
  kind: 'marquee';
  start: Point;
  last: Point;
  moved: boolean;
  rectDiv: HTMLDivElement;
}

interface RotateInteraction {
  kind: 'rotate';
  start: Point;
  last: Point;
  elementId: Id;
  center: Point;
  originalRotation: number;
}

type Interaction = MoveInteraction | ResizeInteraction | MarqueeInteraction | RotateInteraction;

/** Angle (deg, clockwise from 12 o'clock) of the pointer around a center. */
function pointerAngle(center: Point, point: Point): number {
  return normalizeAngle(radToDeg(Math.atan2(point.y - center.y, point.x - center.x)) + 90);
}

const DRAG_THRESHOLD = 3;

export class Canvas {
  readonly el: HTMLElement;

  /** Grid size in points for move snapping; 0 disables snapping. */
  gridSize = 0;
  /** Only snap when within this distance of a grid line (points). */
  snapThreshold = Infinity;

  private readonly state: EditorState;
  private readonly unsubs: (() => void)[] = [];
  private interaction: Interaction | null = null;

  constructor(parent: HTMLElement, state: EditorState) {
    this.state = state;
    this.el = document.createElement('div');
    this.el.className = 'editor-canvas';
    this.el.style.position = 'relative';
    this.el.style.overflow = 'hidden';
    this.el.tabIndex = 0;

    this.el.addEventListener('mousedown', this.onMouseDown);
    this.el.addEventListener('mousemove', this.onMouseMove);
    this.el.addEventListener('mouseup', this.onMouseUp);
    this.el.addEventListener('keydown', this.onKeyDown);

    for (const event of ['document', 'slide', 'selection', 'view'] as const) {
      this.unsubs.push(state.on(event, () => this.render()));
    }

    parent.appendChild(this.el);
    this.render();
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.el.removeEventListener('mousedown', this.onMouseDown);
    this.el.removeEventListener('mousemove', this.onMouseMove);
    this.el.removeEventListener('mouseup', this.onMouseUp);
    this.el.removeEventListener('keydown', this.onKeyDown);
    this.el.remove();
  }

  // --- Rendering -----------------------------------------------------------------

  render(): void {
    const { presentation, zoom } = this.state;
    this.el.style.width = `${presentation.slideSize.width * zoom}px`;
    this.el.style.height = `${presentation.slideSize.height * zoom}px`;
    this.el.innerHTML = '';

    const slide = this.state.currentSlide();
    if (!slide) return;

    const scheme = schemeForSlide(presentation, slide);
    const selected = new Set(this.state.selection.elementIds);
    for (const element of slide.elements) {
      const div = renderElementDiv(element, scheme, zoom);
      if (selected.has(element.id)) {
        div.classList.add('selected');
        this.appendHandles(div);
      }
      this.el.appendChild(div);
    }
  }

  private appendHandles(div: HTMLElement): void {
    for (const name of HANDLE_NAMES) {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.dataset.handle = name;
      div.appendChild(handle);
    }
    const rotate = document.createElement('div');
    rotate.className = 'rotate-handle';
    rotate.dataset.handle = 'rotate';
    div.appendChild(rotate);
  }

  /** Sync existing element divs' geometry from the model (live drag preview). */
  private syncTransforms(): void {
    const slide = this.state.currentSlide();
    if (!slide) return;
    const zoom = this.state.zoom;
    for (const child of Array.from(this.el.children)) {
      const div = child as HTMLElement;
      const id = div.dataset.elementId;
      if (!id) continue;
      const element = findElementById(slide.elements, id);
      if (element) applyTransformStyles(div, element, zoom);
    }
  }

  // --- Coordinates ------------------------------------------------------------------

  private toSlidePoint(event: MouseEvent): Point {
    const rect = this.el.getBoundingClientRect();
    const zoom = this.state.zoom;
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  }

  // --- Mouse interactions -------------------------------------------------------------

  private readonly onMouseDown = (event: MouseEvent): void => {
    const slide = this.state.currentSlide();
    if (!slide) return;
    const point = this.toSlidePoint(event);
    const target = event.target as HTMLElement | null;

    // 0. Rotate handle?
    const rotateDiv = target?.closest('.rotate-handle') as HTMLElement | null;
    if (rotateDiv) {
      const elementDiv = rotateDiv.closest('[data-element-id]') as HTMLElement | null;
      const id = elementDiv?.dataset.elementId;
      const element = id ? findElementById(slide.elements, id) : undefined;
      if (element && !element.locked) {
        const t = element.transform;
        this.interaction = {
          kind: 'rotate',
          start: point,
          last: point,
          elementId: element.id,
          center: { x: t.x + t.width / 2, y: t.y + t.height / 2 },
          originalRotation: t.rotation,
        };
      }
      return;
    }

    // 1. Resize handle?
    const handleDiv = target?.closest('.resize-handle') as HTMLElement | null;
    if (handleDiv) {
      const elementDiv = handleDiv.closest('[data-element-id]') as HTMLElement | null;
      const id = elementDiv?.dataset.elementId;
      const element = id ? findElementById(slide.elements, id) : undefined;
      if (element && !element.locked) {
        this.interaction = {
          kind: 'resize',
          start: point,
          last: point,
          elementId: element.id,
          handle: (handleDiv.dataset.handle ?? 'bottomRight') as HandleName,
          original: { ...element.transform },
        };
      }
      return;
    }

    // 2. Element body?
    const elementDiv = target?.closest('[data-element-id]') as HTMLElement | null;
    if (elementDiv) {
      // Selection targets top-level elements: walk up to the outermost div.
      let top = elementDiv;
      let parent = top.parentElement;
      while (parent && parent !== this.el) {
        if (parent.dataset.elementId) top = parent;
        parent = parent.parentElement;
      }
      const id = top.dataset.elementId as Id;
      if (event.shiftKey) {
        this.state.toggleInSelection(id);
        if (!this.state.selection.elementIds.includes(id)) return;
      } else if (!this.state.selection.elementIds.includes(id)) {
        this.state.selectElements([id]);
      }
      const originals = new Map<Id, { x: number; y: number }>();
      for (const selectedId of this.state.selection.elementIds) {
        const element = findElementById(slide.elements, selectedId);
        if (element && !element.locked) {
          originals.set(selectedId, { x: element.transform.x, y: element.transform.y });
        }
      }
      this.interaction = { kind: 'move', start: point, last: point, originals };
      return;
    }

    // 3. Empty canvas: begin a marquee.
    const rectDiv = document.createElement('div');
    rectDiv.className = 'marquee';
    rectDiv.style.position = 'absolute';
    this.el.appendChild(rectDiv);
    this.interaction = { kind: 'marquee', start: point, last: point, moved: false, rectDiv };
    this.updateMarquee(this.interaction);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    const interaction = this.interaction;
    if (!interaction) return;
    const slide = this.state.currentSlide();
    if (!slide) return;
    const point = this.toSlidePoint(event);
    interaction.last = point;
    const dx = point.x - interaction.start.x;
    const dy = point.y - interaction.start.y;

    if (interaction.kind === 'move') {
      const snapped = this.snappedDelta(interaction.originals, dx, dy);
      for (const [id, orig] of interaction.originals) {
        const element = findElementById(slide.elements, id);
        if (element) {
          element.transform.x = orig.x + snapped.dx;
          element.transform.y = orig.y + snapped.dy;
        }
      }
      this.syncTransforms();
    } else if (interaction.kind === 'rotate') {
      const element = findElementById(slide.elements, interaction.elementId);
      if (element) {
        element.transform.rotation = pointerAngle(interaction.center, point);
        this.syncTransforms();
      }
    } else if (interaction.kind === 'resize') {
      const element = findElementById(slide.elements, interaction.elementId);
      if (element) {
        this.restoreTransform(element, interaction.original);
        const { width, height } = sizeForHandle(interaction.handle, interaction.original, dx, dy);
        resizeElement(element, width, height, HANDLE_ANCHOR[interaction.handle]);
        this.syncTransforms();
      }
    } else {
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        interaction.moved = true;
      }
      this.updateMarquee(interaction);
    }
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    const interaction = this.interaction;
    if (!interaction) return;
    this.interaction = null;
    const slide = this.state.currentSlide();
    if (!slide) return;
    const point = this.toSlidePoint(event);
    const dx = point.x - interaction.start.x;
    const dy = point.y - interaction.start.y;

    if (interaction.kind === 'move') {
      // Revert the live preview, then commit as one undoable step.
      for (const [id, orig] of interaction.originals) {
        const element = findElementById(slide.elements, id);
        if (element) {
          element.transform.x = orig.x;
          element.transform.y = orig.y;
        }
      }
      const snapped = this.snappedDelta(interaction.originals, dx, dy);
      if (snapped.dx !== 0 || snapped.dy !== 0) {
        this.state.translateSelection(snapped.dx, snapped.dy);
      } else {
        this.render();
      }
      return;
    }

    if (interaction.kind === 'rotate') {
      const element = findElementById(slide.elements, interaction.elementId);
      if (element) element.transform.rotation = interaction.originalRotation;
      if (dx !== 0 || dy !== 0) {
        this.state.setRotationOf(interaction.elementId, pointerAngle(interaction.center, point));
      } else {
        this.render();
      }
      return;
    }

    if (interaction.kind === 'resize') {
      const element = findElementById(slide.elements, interaction.elementId);
      if (element) this.restoreTransform(element, interaction.original);
      if (dx !== 0 || dy !== 0) {
        const { width, height } = sizeForHandle(interaction.handle, interaction.original, dx, dy);
        this.state.resizeElementTo(
          interaction.elementId,
          width,
          height,
          HANDLE_ANCHOR[interaction.handle],
        );
      } else {
        this.render();
      }
      return;
    }

    // Marquee.
    interaction.rectDiv.remove();
    if (!interaction.moved) {
      this.state.clearSelection();
      return;
    }
    const rect = {
      x: Math.min(interaction.start.x, point.x),
      y: Math.min(interaction.start.y, point.y),
      width: Math.abs(point.x - interaction.start.x),
      height: Math.abs(point.y - interaction.start.y),
    };
    const hits = elementsInRect(slide.elements, rect);
    this.state.selectElements(hits.map((el) => el.id));
  };

  /** Adjust a move delta so the primary element lands on the grid. */
  private snappedDelta(
    originals: Map<Id, { x: number; y: number }>,
    dx: number,
    dy: number,
  ): { dx: number; dy: number } {
    if (this.gridSize <= 0) return { dx, dy };
    const first = originals.values().next().value as { x: number; y: number } | undefined;
    if (!first) return { dx, dy };
    return {
      dx: snapValue(first.x + dx, this.gridSize, this.snapThreshold) - first.x,
      dy: snapValue(first.y + dy, this.gridSize, this.snapThreshold) - first.y,
    };
  }

  /** Abort the in-progress mouse interaction and restore the model. */
  cancelInteraction(): void {
    const interaction = this.interaction;
    if (!interaction) return;
    this.interaction = null;
    const slide = this.state.currentSlide();
    if (slide) {
      if (interaction.kind === 'move') {
        for (const [id, orig] of interaction.originals) {
          const element = findElementById(slide.elements, id);
          if (element) {
            element.transform.x = orig.x;
            element.transform.y = orig.y;
          }
        }
      } else if (interaction.kind === 'resize') {
        const element = findElementById(slide.elements, interaction.elementId);
        if (element) this.restoreTransform(element, interaction.original);
      } else if (interaction.kind === 'rotate') {
        const element = findElementById(slide.elements, interaction.elementId);
        if (element) element.transform.rotation = interaction.originalRotation;
      } else {
        interaction.rectDiv.remove();
      }
    }
    this.render();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.interaction) this.cancelInteraction();
      else this.state.clearSelection();
      event.preventDefault();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      this.state.deleteSelection();
      event.preventDefault();
    }
  };

  private restoreTransform(element: SlideElement, original: Transform): void {
    element.transform.x = original.x;
    element.transform.y = original.y;
    element.transform.width = original.width;
    element.transform.height = original.height;
  }

  private updateMarquee(interaction: MarqueeInteraction): void {
    const zoom = this.state.zoom;
    const x = Math.min(interaction.start.x, interaction.last.x) * zoom;
    const y = Math.min(interaction.start.y, interaction.last.y) * zoom;
    const width = Math.abs(interaction.last.x - interaction.start.x) * zoom;
    const height = Math.abs(interaction.last.y - interaction.start.y) * zoom;
    interaction.rectDiv.style.left = `${x}px`;
    interaction.rectDiv.style.top = `${y}px`;
    interaction.rectDiv.style.width = `${width}px`;
    interaction.rectDiv.style.height = `${height}px`;
  }
}
