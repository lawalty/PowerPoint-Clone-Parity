/**
 * EditorState: the single source of truth for the interactive editor UI.
 *
 * Holds the presentation document, the current slide, the selection, view
 * mode and zoom, plus a History (undo/redo) and a Clipboard. Every mutation
 * goes through a method here that wraps the engine call in an undoable
 * command and emits change events for the UI components.
 *
 * Events:
 *  - 'document'  : the presentation content changed (elements, slides, theme)
 *  - 'selection' : the element selection changed
 *  - 'slide'     : the current slide changed
 *  - 'view'      : view mode / zoom / slideshow state changed
 */

import type {
  Animation,
  AnimationCategory,
  AnimationEffect,
  BulletNumbered,
  ChartKind,
  Color,
  EditorSelection,
  Fill,
  Id,
  LineStyle,
  Presentation,
  ShapeGeometry,
  Slide,
  SlideElement,
  TextAlign,
  TextBody,
  Transition,
  ViewMode,
} from '../core/types';
import {
  createPresentation,
  addSlide,
  deleteSlide,
  duplicateSlide,
  moveSlide,
  getSlideIndex,
  getVisibleSlides,
  getLayout,
  setSlideHidden,
  getNotesText,
  setNotesText,
  serializePresentation,
  deserializePresentation,
} from '../model';
import {
  createShape,
  createTextBox,
  createPicture,
  createLine,
  moveElement,
  resizeElement,
  setRotation,
  groupElements,
  ungroup,
  alignElements,
  distributeElements,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  findElementById,
  removeElementById,
  duplicateElement,
  visitElements,
  type Alignment,
  type ResizeAnchor,
} from '../shapes';
import {
  toggleFormat,
  applyCharFormat,
  rangeHasUniformFormat,
  setAlignment,
  toggleBulletList,
  toggleNumberedList,
  endOfBody,
  findInBodies,
  replaceInBody,
  type FindOptions,
  type ToggleableFormatKey,
  type BodySource,
} from '../text';
import { builtInThemes, applyTheme } from '../style';
import { History, Clipboard, slideMutation, presentationMutation } from '../commands';
import {
  setTransition,
  addAnimation,
  removeAnimation,
  type AddAnimationOptions,
} from '../animation';
import { SlideshowController, type SlideshowOptions } from '../slideshow';
import { createTable } from '../tables';
import { createChart } from '../charts';

export type EditorEvent = 'document' | 'selection' | 'slide' | 'view';

export type ReorderDirection = 'front' | 'back' | 'forward' | 'backward';
export type TextToggleKey = Extract<ToggleableFormatKey, 'bold' | 'italic' | 'underline'>;

export class EditorState {
  presentation: Presentation;
  currentSlideId: Id;
  selection: EditorSelection;
  viewMode: ViewMode = 'normal';
  zoom = 1;
  /** Active slideshow controller, or null when editing. */
  activeShow: SlideshowController | null = null;

  readonly history = new History();
  readonly clipboard = new Clipboard();

  private readonly listeners = new Map<EditorEvent, Set<() => void>>();

  constructor(presentation?: Presentation) {
    this.presentation = presentation ?? createPresentation();
    this.currentSlideId = this.presentation.slides[0]?.id ?? '';
    this.selection = { slideId: this.currentSlideId || null, elementIds: [] };
  }

  // --- Events ---------------------------------------------------------------

  /** Subscribe to a state event; returns an unsubscribe function. */
  on(event: EditorEvent, cb: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  private emit(...events: EditorEvent[]): void {
    for (const event of events) {
      const set = this.listeners.get(event);
      if (set) for (const cb of [...set]) cb();
    }
  }

  // --- Lookup helpers ---------------------------------------------------------

  /** The current slide, or null when the presentation has no slides. */
  currentSlide(): Slide | null {
    return this.presentation.slides.find((s) => s.id === this.currentSlideId) ?? null;
  }

  /** The currently selected element objects (in selection order). */
  selectedElements(): SlideElement[] {
    const slide = this.currentSlide();
    if (!slide) return [];
    const out: SlideElement[] = [];
    for (const id of this.selection.elementIds) {
      const el = findElementById(slide.elements, id);
      if (el) out.push(el);
    }
    return out;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  // --- Slide navigation & selection ------------------------------------------

  selectSlide(slideId: Id): void {
    if (slideId === this.currentSlideId) return;
    if (getSlideIndex(this.presentation, slideId) === -1) return;
    this.currentSlideId = slideId;
    this.selection = { slideId, elementIds: [] };
    this.emit('slide', 'selection');
  }

  selectElements(ids: Id[]): void {
    this.selection = { slideId: this.currentSlideId || null, elementIds: [...ids] };
    this.emit('selection');
  }

  addToSelection(id: Id): void {
    if (this.selection.elementIds.includes(id)) return;
    this.selection = {
      slideId: this.currentSlideId || null,
      elementIds: [...this.selection.elementIds, id],
    };
    this.emit('selection');
  }

  /** Add the id when not selected, remove it when it already is. */
  toggleInSelection(id: Id): void {
    const ids = this.selection.elementIds;
    this.selection = {
      slideId: this.currentSlideId || null,
      elementIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    };
    this.emit('selection');
  }

  clearSelection(): void {
    if (this.selection.elementIds.length === 0) return;
    this.selection = { slideId: this.currentSlideId || null, elementIds: [] };
    this.emit('selection');
  }

  /** Select every top-level element on the current slide. */
  selectAllOnSlide(): void {
    const slide = this.currentSlide();
    if (!slide) return;
    this.selectElements(slide.elements.map((el) => el.id));
  }

  // --- Element insertion -------------------------------------------------------

  private insertElement(element: SlideElement, label: string): SlideElement {
    const slide = this.currentSlide();
    if (!slide) throw new Error('No current slide to insert into');
    const t = element.transform;
    t.x = (this.presentation.slideSize.width - t.width) / 2;
    t.y = (this.presentation.slideSize.height - t.height) / 2;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, label, (s) => {
        s.elements.push(element);
      }),
    );
    this.selection = { slideId: this.currentSlideId, elementIds: [element.id] };
    this.emit('document', 'selection');
    return element;
  }

  insertShape(geometry: ShapeGeometry = 'rectangle'): SlideElement {
    return this.insertElement(createShape(geometry, { width: 200, height: 150 }), 'Insert Shape');
  }

  insertTextBox(text = ''): SlideElement {
    return this.insertElement(createTextBox(text), 'Insert Text Box');
  }

  insertPicture(src: string): SlideElement {
    return this.insertElement(createPicture(src, { width: 300, height: 200 }), 'Insert Picture');
  }

  insertTable(rows = 3, cols = 3): SlideElement {
    return this.insertElement(createTable(rows, cols), 'Insert Table');
  }

  insertChart(kind: ChartKind = 'column'): SlideElement {
    return this.insertElement(createChart(kind), 'Insert Chart');
  }

  insertLine(): SlideElement {
    return this.insertElement(createLine('straight', { width: 200, height: 0 }), 'Insert Line');
  }

  // --- Selection mutations -------------------------------------------------------

  deleteSelection(): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    const label = ids.length === 1 ? 'Delete Element' : `Delete ${ids.length} Elements`;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, label, (slide) => {
        for (const id of ids) removeElementById(slide.elements, id);
        slide.animations = slide.animations.filter((a) => !ids.includes(a.targetElementId));
      }),
    );
    this.selection = { slideId: this.currentSlideId, elementIds: [] };
    this.emit('document', 'selection');
  }

  duplicateSelection(): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    let cloneIds: Id[] = [];
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Duplicate', (slide) => {
        const clones: SlideElement[] = [];
        for (const id of ids) {
          const el = findElementById(slide.elements, id);
          if (el) clones.push(duplicateElement(el));
        }
        cloneIds = clones.map((c) => c.id);
        slide.elements.push(...clones);
      }),
    );
    if (cloneIds.length) {
      this.selection = { slideId: this.currentSlideId, elementIds: cloneIds };
    }
    this.emit('document', 'selection');
  }

  groupSelection(): void {
    const ids = new Set(this.selection.elementIds);
    if (ids.size < 2 || !this.currentSlide()) return;
    let groupId: Id | null = null;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Group', (slide) => {
        const members = slide.elements.filter((el) => ids.has(el.id));
        if (members.length < 2) return;
        slide.elements = slide.elements.filter((el) => !ids.has(el.id));
        const group = groupElements(members);
        groupId = group.id;
        slide.elements.push(group);
      }),
    );
    if (groupId) {
      this.selection = { slideId: this.currentSlideId, elementIds: [groupId] };
    }
    this.emit('document', 'selection');
  }

  ungroupSelection(): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    const childIds: Id[] = [];
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Ungroup', (slide) => {
        for (const id of ids) {
          const index = slide.elements.findIndex((el) => el.id === id);
          if (index === -1) continue;
          const el = slide.elements[index];
          if (el.type !== 'group') {
            childIds.push(el.id);
            continue;
          }
          const children = ungroup(el);
          childIds.push(...children.map((c) => c.id));
          slide.elements.splice(index, 1, ...children);
        }
      }),
    );
    if (childIds.length) {
      this.selection = { slideId: this.currentSlideId, elementIds: childIds };
    }
    this.emit('document', 'selection');
  }

  align(alignment: Alignment, relativeTo: 'selection' | 'slide' = 'selection'): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    const slideSize = this.presentation.slideSize;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Align', (slide) => {
        const els = ids
          .map((id) => findElementById(slide.elements, id))
          .filter((el): el is SlideElement => el !== undefined);
        alignElements(els, alignment, relativeTo === 'slide' ? { slide: slideSize } : 'selection');
      }),
    );
    this.emit('document');
  }

  distribute(axis: 'horizontal' | 'vertical'): void {
    const ids = [...this.selection.elementIds];
    if (ids.length < 3 || !this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Distribute', (slide) => {
        const els = ids
          .map((id) => findElementById(slide.elements, id))
          .filter((el): el is SlideElement => el !== undefined);
        distributeElements(els, axis);
      }),
    );
    this.emit('document');
  }

  reorder(direction: ReorderDirection): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Reorder', (slide) => {
        for (const id of ids) {
          switch (direction) {
            case 'front':
              bringToFront(slide.elements, id);
              break;
            case 'back':
              sendToBack(slide.elements, id);
              break;
            case 'forward':
              bringForward(slide.elements, id);
              break;
            case 'backward':
              sendBackward(slide.elements, id);
              break;
          }
        }
      }),
    );
    this.emit('document');
  }

  /** Translate all selected elements by (dx, dy) as ONE undo step. */
  translateSelection(dx: number, dy: number): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || (dx === 0 && dy === 0) || !this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Move', (slide) => {
        for (const id of ids) {
          const el = findElementById(slide.elements, id);
          if (el && !el.locked) moveElement(el, dx, dy);
        }
      }),
    );
    this.emit('document');
  }

  /** Resize one element to (width, height) about the given anchor: one undo step. */
  resizeElementTo(id: Id, width: number, height: number, anchor: ResizeAnchor = 'topLeft'): void {
    if (!this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Resize', (slide) => {
        const el = findElementById(slide.elements, id);
        if (el && !el.locked) resizeElement(el, width, height, anchor);
      }),
    );
    this.emit('document');
  }

  /** Set one element's rotation (degrees): one undo step. */
  setRotationOf(id: Id, degrees: number): void {
    if (!this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Rotate', (slide) => {
        const el = findElementById(slide.elements, id);
        if (el && !el.locked) setRotation(el, degrees);
      }),
    );
    this.emit('document');
  }

  // --- Text formatting ------------------------------------------------------------

  /** Run `fn` over the text body of every selected shape/textbox: one undo step. */
  private mutateSelectedBodies(label: string, fn: (body: TextBody) => void): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, label, (slide) => {
        for (const id of ids) {
          const el = findElementById(slide.elements, id);
          if (el && (el.type === 'shape' || el.type === 'textbox')) fn(el.textBody);
        }
      }),
    );
    this.emit('document');
  }

  /** Toggle bold/italic/underline across the whole text body of the selection. */
  applyTextFormat(key: TextToggleKey): void {
    this.mutateSelectedBodies('Format Text', (body) => {
      toggleFormat(body, { paragraphIndex: 0, offset: 0 }, endOfBody(body), key);
    });
  }

  /**
   * True when every selected text-bearing element has the format on across
   * its whole body (drives toolbar toggle-button pressed state).
   */
  selectionHasFormat(key: TextToggleKey): boolean {
    const els = this.selectedElements().filter(
      (el) => el.type === 'shape' || el.type === 'textbox',
    );
    if (els.length === 0) return false;
    return els.every(
      (el) =>
        (el.type === 'shape' || el.type === 'textbox') &&
        rangeHasUniformFormat(
          el.textBody,
          { paragraphIndex: 0, offset: 0 },
          endOfBody(el.textBody),
          key,
        ) === true,
    );
  }

  /** Set paragraph alignment across the whole text body of the selection. */
  setTextAlignment(align: TextAlign): void {
    this.mutateSelectedBodies('Align Text', (body) => {
      setAlignment(body, 0, body.paragraphs.length - 1, align);
    });
  }

  setFontSize(size: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    this.mutateSelectedBodies('Font Size', (body) => {
      applyCharFormat(body, { paragraphIndex: 0, offset: 0 }, endOfBody(body), { size });
    });
  }

  setFontColor(color: Color): void {
    this.mutateSelectedBodies('Font Color', (body) => {
      applyCharFormat(body, { paragraphIndex: 0, offset: 0 }, endOfBody(body), { color });
    });
  }

  setFontFamily(family: string): void {
    this.mutateSelectedBodies('Font', (body) => {
      applyCharFormat(body, { paragraphIndex: 0, offset: 0 }, endOfBody(body), { family });
    });
  }

  /** Toggle a char bullet on every paragraph of the selected text bodies. */
  toggleBullets(char = '•'): void {
    this.mutateSelectedBodies('Bullets', (body) => {
      toggleBulletList(body, 0, body.paragraphs.length - 1, char);
    });
  }

  /** Toggle a numbered list on every paragraph of the selected text bodies. */
  toggleNumbering(format: BulletNumbered['format'] = 'arabicPeriod'): void {
    this.mutateSelectedBodies('Numbering', (body) => {
      toggleNumberedList(body, 0, body.paragraphs.length - 1, format);
    });
  }

  // --- Fill & line styling -----------------------------------------------------------

  /** Apply a fill to every selected fill-bearing element (shape/textbox/freeform). */
  setFillForSelection(fill: Fill): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Fill', (slide) => {
        for (const id of ids) {
          const el = findElementById(slide.elements, id);
          if (el && (el.type === 'shape' || el.type === 'textbox' || el.type === 'freeform')) {
            el.fill = structuredClone(fill);
          }
        }
      }),
    );
    this.emit('document');
  }

  /** Patch the line style of every selected element that has one. */
  setLineForSelection(patch: Partial<LineStyle>): void {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Line', (slide) => {
        for (const id of ids) {
          const el = findElementById(slide.elements, id);
          if (el && 'line' in el) {
            Object.assign(el.line, structuredClone(patch));
          }
        }
      }),
    );
    this.emit('document');
  }

  // --- Slide operations -------------------------------------------------------------

  setSlideLayout(layoutId: Id): void {
    const slide = this.currentSlide();
    if (!slide || slide.layoutId === layoutId) return;
    getLayout(this.presentation, layoutId); // throws for unknown layout ids
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Layout', (s) => {
        s.layoutId = layoutId;
      }),
    );
    this.emit('document');
  }

  addSlideAfterCurrent(layoutId?: Id): Id {
    const index = getSlideIndex(this.presentation, this.currentSlideId);
    const at = index === -1 ? this.presentation.slides.length : index + 1;
    let newId: Id = '';
    this.history.run(
      presentationMutation(this.presentation, 'New Slide', (pres) => {
        newId = addSlide(pres, layoutId, at).id;
      }),
    );
    this.currentSlideId = newId;
    this.selection = { slideId: newId, elementIds: [] };
    this.emit('document', 'slide', 'selection');
    return newId;
  }

  deleteCurrentSlide(): void {
    this.deleteSlideById(this.currentSlideId);
  }

  deleteSlideById(slideId: Id): void {
    if (this.presentation.slides.length <= 1) return;
    const index = getSlideIndex(this.presentation, slideId);
    if (index === -1) return;
    this.history.run(
      presentationMutation(this.presentation, 'Delete Slide', (pres) => {
        deleteSlide(pres, slideId);
      }),
    );
    if (this.currentSlideId === slideId) {
      const next = Math.min(index, this.presentation.slides.length - 1);
      this.currentSlideId = this.presentation.slides[next].id;
      this.selection = { slideId: this.currentSlideId, elementIds: [] };
    }
    this.emit('document', 'slide', 'selection');
  }

  duplicateSlideById(slideId: Id): Id | null {
    if (getSlideIndex(this.presentation, slideId) === -1) return null;
    let copyId: Id = '';
    this.history.run(
      presentationMutation(this.presentation, 'Duplicate Slide', (pres) => {
        copyId = duplicateSlide(pres, slideId).id;
      }),
    );
    this.currentSlideId = copyId;
    this.selection = { slideId: copyId, elementIds: [] };
    this.emit('document', 'slide', 'selection');
    return copyId;
  }

  duplicateCurrentSlide(): Id | null {
    return this.duplicateSlideById(this.currentSlideId);
  }

  moveSlideUpDown(direction: 'up' | 'down'): void {
    this.moveSlideBy(this.currentSlideId, direction);
  }

  moveSlideBy(slideId: Id, direction: 'up' | 'down'): void {
    const from = getSlideIndex(this.presentation, slideId);
    if (from === -1) return;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= this.presentation.slides.length) return;
    this.history.run(
      presentationMutation(this.presentation, 'Move Slide', (pres) => {
        moveSlide(pres, from, to);
      }),
    );
    this.emit('document');
  }

  /** Move a slide to an absolute index (drag-reorder API). */
  moveSlideTo(slideId: Id, toIndex: number): void {
    const from = getSlideIndex(this.presentation, slideId);
    if (from === -1) return;
    const to = Math.max(0, Math.min(this.presentation.slides.length - 1, toIndex));
    if (to === from) return;
    this.history.run(
      presentationMutation(this.presentation, 'Move Slide', (pres) => {
        moveSlide(pres, from, to);
      }),
    );
    this.emit('document');
  }

  toggleSlideHidden(slideId: Id): void {
    const index = getSlideIndex(this.presentation, slideId);
    if (index === -1) return;
    const hidden = this.presentation.slides[index].hidden;
    this.history.run(
      presentationMutation(this.presentation, hidden ? 'Unhide Slide' : 'Hide Slide', (pres) => {
        setSlideHidden(pres, slideId, !hidden);
      }),
    );
    this.emit('document');
  }

  // --- Undo / redo -------------------------------------------------------------------

  undo(): void {
    if (!this.history.canUndo) return;
    this.history.undo();
    this.afterHistoryJump();
  }

  redo(): void {
    if (!this.history.canRedo) return;
    this.history.redo();
    this.afterHistoryJump();
  }

  /** Reconcile current slide + selection after an undo/redo restored state. */
  private afterHistoryJump(): void {
    if (getSlideIndex(this.presentation, this.currentSlideId) === -1) {
      this.currentSlideId = this.presentation.slides[0]?.id ?? '';
    }
    const slide = this.currentSlide();
    const surviving = slide
      ? this.selection.elementIds.filter((id) => findElementById(slide.elements, id))
      : [];
    this.selection = { slideId: this.currentSlideId || null, elementIds: surviving };
    this.emit('document', 'slide', 'selection');
  }

  // --- Clipboard -----------------------------------------------------------------------

  copy(): void {
    const els = this.selectedElements();
    if (els.length === 0) return;
    this.clipboard.copyElements(els);
  }

  cut(): void {
    const els = this.selectedElements();
    if (els.length === 0) return;
    this.clipboard.copyElements(els);
    this.deleteSelection();
  }

  paste(): void {
    if (this.clipboard.contentType() !== 'elements' || !this.currentSlide()) return;
    let pastedIds: Id[] = [];
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Paste', (slide) => {
        pastedIds = this.clipboard.pasteElements(slide).map((el) => el.id);
      }),
    );
    if (pastedIds.length) {
      this.selection = { slideId: this.currentSlideId, elementIds: pastedIds };
    }
    this.emit('document', 'selection');
  }

  // --- Theme & transitions ---------------------------------------------------------------

  /** Apply a built-in theme by id (e.g. 'theme-facet') or name (e.g. 'Facet'). */
  setTheme(themeIdOrName: string): void {
    const theme = builtInThemes().find(
      (t) => t.id === themeIdOrName || t.name.toLowerCase() === themeIdOrName.toLowerCase(),
    );
    if (!theme) throw new Error(`Unknown built-in theme: ${themeIdOrName}`);
    this.history.run(
      presentationMutation(this.presentation, 'Apply Theme', (pres) => {
        applyTheme(pres, theme);
      }),
    );
    this.emit('document');
  }

  setTransitionForCurrent(patch: Partial<Transition>): void {
    if (!this.currentSlide()) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Transition', (slide) => {
        setTransition(slide, patch);
      }),
    );
    this.emit('document');
  }

  // --- Animations ----------------------------------------------------------------------

  /**
   * Add an animation of the given category/effect targeting every selected
   * element (one undo step). Returns the animations created.
   */
  addAnimationToSelection(
    category: AnimationCategory,
    effect: AnimationEffect,
    opts: AddAnimationOptions = {},
  ): Animation[] {
    const ids = [...this.selection.elementIds];
    if (ids.length === 0 || !this.currentSlide()) return [];
    let created: Animation[] = [];
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Add Animation', (slide) => {
        created = ids.map((id) => addAnimation(slide, id, category, effect, opts));
      }),
    );
    this.emit('document');
    return created;
  }

  removeAnimationById(animId: Id): void {
    const slide = this.currentSlide();
    if (!slide || !slide.animations.some((a) => a.id === animId)) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Remove Animation', (s) => {
        removeAnimation(s, animId);
      }),
    );
    this.emit('document');
  }

  /** Animations on the current slide (play order). */
  currentAnimations(): Animation[] {
    return this.currentSlide()?.animations ?? [];
  }

  // --- Notes ------------------------------------------------------------------------------

  notesTextForCurrent(): string {
    if (!this.currentSlide()) return '';
    return getNotesText(this.presentation, this.currentSlideId);
  }

  setNotesForCurrent(text: string): void {
    if (!this.currentSlide()) return;
    if (this.notesTextForCurrent() === text) return;
    this.history.run(
      slideMutation(this.presentation, this.currentSlideId, 'Edit Notes', () => {
        setNotesText(this.presentation, this.currentSlideId, text);
      }),
    );
    this.emit('document');
  }

  // --- View / slideshow ---------------------------------------------------------------------

  setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.emit('view');
  }

  setZoom(zoom: number): void {
    const next = Math.min(4, Math.max(0.1, zoom));
    if (next === this.zoom) return;
    this.zoom = next;
    this.emit('view');
  }

  startSlideshow(options: Omit<SlideshowOptions, 'startSlideId'> = {}): SlideshowController {
    const visible = getVisibleSlides(this.presentation);
    const startSlideId = visible.some((s) => s.id === this.currentSlideId)
      ? this.currentSlideId
      : undefined;
    const controller = new SlideshowController(this.presentation, { ...options, startSlideId });
    this.activeShow = controller;
    this.viewMode = 'reading';
    this.emit('view');
    return controller;
  }

  /** Advance the running show; ends it after stepping past the last slide. */
  slideshowNext(): void {
    const show = this.activeShow;
    if (!show) return;
    show.next();
    if (show.finished) {
      this.endSlideshow();
      return;
    }
    this.emit('view');
  }

  /** Step the running show backwards. */
  slideshowPrev(): void {
    const show = this.activeShow;
    if (!show) return;
    show.prev();
    this.emit('view');
  }

  endSlideshow(): void {
    if (!this.activeShow) return;
    this.activeShow.end();
    this.activeShow = null;
    this.viewMode = 'normal';
    this.emit('view');
  }

  // --- Find & replace --------------------------------------------------------------------------

  /**
   * Find (and optionally replace) `query` across every text body on every
   * slide. Returns the number of matches found (= replacements made when a
   * replacement string is given). Replacement is a single undo step.
   */
  findReplace(query: string, replacement?: string, opts: FindOptions = {}): number {
    if (query.length === 0) return 0;
    if (replacement === undefined) {
      const sources: BodySource[] = [];
      for (const slide of this.presentation.slides) {
        visitElements(slide.elements, (el) => {
          if (el.type === 'shape' || el.type === 'textbox') {
            sources.push({ elementId: el.id, body: el.textBody });
          }
        });
      }
      return findInBodies(sources, query, opts).length;
    }

    let count = 0;
    this.history.run(
      presentationMutation(this.presentation, 'Replace All', (pres) => {
        count = 0;
        for (const slide of pres.slides) {
          visitElements(slide.elements, (el) => {
            if (el.type === 'shape' || el.type === 'textbox') {
              count += replaceInBody(el.textBody, query, replacement, opts);
            }
          });
        }
      }),
    );
    this.emit('document');
    return count;
  }

  // --- Persistence -------------------------------------------------------------------------------

  save(): string {
    return serializePresentation(this.presentation);
  }

  load(json: string): void {
    const pres = deserializePresentation(json);
    this.presentation = pres;
    this.resetAfterDocumentSwap();
  }

  newDocument(): void {
    this.presentation = createPresentation();
    this.resetAfterDocumentSwap();
  }

  private resetAfterDocumentSwap(): void {
    this.history.clear();
    this.activeShow = null;
    this.viewMode = 'normal';
    this.zoom = 1;
    this.currentSlideId = this.presentation.slides[0]?.id ?? '';
    this.selection = { slideId: this.currentSlideId || null, elementIds: [] };
    this.emit('document', 'slide', 'selection', 'view');
  }
}
