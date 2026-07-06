/**
 * Application shell: assembles toolbar + slide panel + canvas + notes pane +
 * status bar inside a container element, wires global keyboard shortcuts, and
 * re-renders the main area per view mode (normal/notes = canvas, sorter =
 * thumbnail grid, outline = title/body text list, reading = slideshow view).
 */

import type { Presentation } from '../core/types';
import { getSlideIndex } from '../model';
import { EditorState } from './state';
import { Canvas } from './canvas';
import { Toolbar } from './toolbar';
import { SlidePanel } from './slide-panel';
import { renderElementDiv, schemeForSlide, slideBodyTexts, slideTitleText } from './element-dom';

export interface CreateAppOptions {
  presentation?: Presentation;
}

export interface App {
  state: EditorState;
  /** Root element appended to the container. */
  el: HTMLElement;
  toolbar: Toolbar;
  slidePanel: SlidePanel;
  canvas: Canvas;
  /** Hosts the canvas in normal/notes view. */
  canvasHost: HTMLElement;
  /** Hosts sorter / outline / reading views. */
  altView: HTMLElement;
  statusBar: HTMLElement;
  notesPane: HTMLTextAreaElement;
  destroy(): void;
}

const VIEW_LABEL: Record<string, string> = {
  normal: 'Normal',
  sorter: 'Slide Sorter',
  notes: 'Notes Page',
  reading: 'Reading View',
  outline: 'Outline',
};

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function createApp(container: HTMLElement, options: CreateAppOptions = {}): App {
  const state = new EditorState(options.presentation);
  const doc = container.ownerDocument;

  const root = doc.createElement('div');
  root.className = 'app';

  const toolbar = new Toolbar(root, state);

  const body = doc.createElement('div');
  body.className = 'app-body';
  root.appendChild(body);

  const slidePanel = new SlidePanel(body, state);

  const main = doc.createElement('div');
  main.className = 'app-main';
  body.appendChild(main);

  const canvasHost = doc.createElement('div');
  canvasHost.className = 'canvas-host';
  main.appendChild(canvasHost);
  const canvas = new Canvas(canvasHost, state);

  const altView = doc.createElement('div');
  altView.className = 'alt-view';
  main.appendChild(altView);

  const notesWrap = doc.createElement('div');
  notesWrap.className = 'notes-pane';
  const notesLabel = doc.createElement('div');
  notesLabel.className = 'notes-label';
  notesLabel.textContent = 'Notes';
  const notesPane = doc.createElement('textarea');
  notesPane.className = 'notes-input';
  notesPane.placeholder = 'Click to add notes';
  notesWrap.appendChild(notesLabel);
  notesWrap.appendChild(notesPane);
  root.appendChild(notesWrap);

  const statusBar = doc.createElement('div');
  statusBar.className = 'status-bar';
  const statusSlide = doc.createElement('span');
  statusSlide.className = 'status-slide';
  const statusView = doc.createElement('span');
  statusView.className = 'status-view';
  const statusZoom = doc.createElement('span');
  statusZoom.className = 'status-zoom';
  statusBar.appendChild(statusSlide);
  statusBar.appendChild(statusView);
  statusBar.appendChild(statusZoom);
  root.appendChild(statusBar);

  container.appendChild(root);

  // --- Status bar --------------------------------------------------------------

  function updateStatusBar(): void {
    const { presentation, currentSlideId, zoom, viewMode, activeShow } = state;
    if (activeShow && !activeShow.finished) {
      const info = activeShow.current();
      statusSlide.textContent = `Slide ${info.slideNumber} of ${info.totalVisible}`;
    } else {
      const index = getSlideIndex(presentation, currentSlideId);
      statusSlide.textContent = `Slide ${index + 1} of ${presentation.slides.length}`;
    }
    statusView.textContent = VIEW_LABEL[viewMode] ?? viewMode;
    statusZoom.textContent = `${Math.round(zoom * 100)}%`;
  }

  // --- Notes pane ---------------------------------------------------------------

  function refreshNotes(): void {
    if (doc.activeElement === notesPane) return;
    notesPane.value = state.notesTextForCurrent();
  }

  const onNotesChange = (): void => {
    state.setNotesForCurrent(notesPane.value);
  };
  notesPane.addEventListener('change', onNotesChange);

  // --- Alt views (sorter / outline / reading) -------------------------------------

  function renderSorter(): void {
    const grid = doc.createElement('div');
    grid.className = 'sorter-grid';
    state.presentation.slides.forEach((slide, index) => {
      const thumb = doc.createElement('div');
      thumb.className = 'sorter-thumb';
      thumb.dataset.slideId = slide.id;
      if (slide.id === state.currentSlideId) thumb.classList.add('selected');
      if (slide.hidden) thumb.classList.add('hidden-slide');
      const number = doc.createElement('span');
      number.className = 'thumb-number';
      number.textContent = String(index + 1);
      const title = doc.createElement('span');
      title.className = 'thumb-title';
      title.textContent = slideTitleText(slide);
      thumb.appendChild(number);
      thumb.appendChild(title);
      grid.appendChild(thumb);
    });
    altView.appendChild(grid);
  }

  function renderOutline(): void {
    const outline = doc.createElement('div');
    outline.className = 'outline-view';
    for (const slide of state.presentation.slides) {
      const item = doc.createElement('div');
      item.className = 'outline-slide';
      item.dataset.slideId = slide.id;
      if (slide.id === state.currentSlideId) item.classList.add('selected');
      const title = doc.createElement('div');
      title.className = 'outline-title';
      title.textContent = slideTitleText(slide);
      item.appendChild(title);
      for (const text of slideBodyTexts(slide)) {
        const line = doc.createElement('div');
        line.className = 'outline-text';
        line.textContent = text;
        item.appendChild(line);
      }
      outline.appendChild(item);
    }
    altView.appendChild(outline);
  }

  function renderReading(): void {
    const view = doc.createElement('div');
    view.className = 'reading-view';
    const show = state.activeShow;
    const slide = show && !show.finished ? show.current().slide : state.currentSlide();
    if (slide) {
      const stage = doc.createElement('div');
      stage.className = 'reading-slide';
      stage.style.position = 'relative';
      stage.dataset.slideId = slide.id;
      const scheme = schemeForSlide(state.presentation, slide);
      const hidden = show ? new Set(show.visibleAnimationsState().hidden) : new Set<string>();
      for (const element of slide.elements) {
        const div = renderElementDiv(element, scheme, 1);
        if (hidden.has(element.id)) div.style.display = 'none';
        stage.appendChild(div);
      }
      view.appendChild(stage);
    }
    altView.appendChild(view);
  }

  function renderMain(): void {
    const mode = state.viewMode;
    const usesCanvas = mode === 'normal' || mode === 'notes';
    canvasHost.style.display = usesCanvas ? '' : 'none';
    altView.style.display = usesCanvas ? 'none' : '';
    notesWrap.style.display = mode === 'sorter' || mode === 'reading' ? 'none' : '';
    root.classList.toggle('notes-view', mode === 'notes');
    altView.innerHTML = '';
    if (mode === 'sorter') renderSorter();
    else if (mode === 'outline') renderOutline();
    else if (mode === 'reading') renderReading();
  }

  const onAltViewClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (state.activeShow) {
      state.slideshowNext();
      return;
    }
    const item = target?.closest('[data-slide-id]') as HTMLElement | null;
    if (item?.dataset.slideId) state.selectSlide(item.dataset.slideId);
  };
  altView.addEventListener('click', onAltViewClick);

  // --- Keyboard shortcuts -------------------------------------------------------------

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key;

    // Slideshow mode: navigation keys drive the show.
    if (state.activeShow) {
      if (key === 'Escape') {
        state.endSlideshow();
        event.preventDefault();
        return;
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(key)) {
        state.slideshowNext();
        event.preventDefault();
        return;
      }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) {
        state.slideshowPrev();
        event.preventDefault();
        return;
      }
      return;
    }

    if (key === 'F5') {
      state.startSlideshow();
      event.preventDefault();
      return;
    }

    const mod = event.ctrlKey || event.metaKey;

    // Let text inputs handle their own (non-shortcut) keys.
    if (!mod && isEditableTarget(event.target)) {
      return;
    }

    if (mod) {
      switch (key.toLowerCase()) {
        case 'z':
          if (event.shiftKey) state.redo();
          else state.undo();
          break;
        case 'y': state.redo(); break;
        case 'c': state.copy(); break;
        case 'x': state.cut(); break;
        case 'v': state.paste(); break;
        case 'd': state.duplicateSelection(); break;
        case 'a': state.selectAllOnSlide(); break;
        case 'b': state.applyTextFormat('bold'); break;
        case 'i': state.applyTextFormat('italic'); break;
        case 'u': state.applyTextFormat('underline'); break;
        case 'm': state.addSlideAfterCurrent(); break;
        default: return;
      }
      event.preventDefault();
      return;
    }

    switch (key) {
      case 'Delete':
      case 'Backspace':
        state.deleteSelection();
        event.preventDefault();
        break;
      case 'Escape':
        state.clearSelection();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (state.selection.elementIds.length === 0) return;
        const step = event.shiftKey ? 10 : 1;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        state.translateSelection(dx, dy);
        event.preventDefault();
        break;
      }
      default:
        break;
    }
  };
  doc.addEventListener('keydown', onKeyDown);

  // --- State subscriptions --------------------------------------------------------

  const unsubs = [
    state.on('slide', () => {
      updateStatusBar();
      refreshNotes();
      if (state.viewMode !== 'normal' && state.viewMode !== 'notes') renderMain();
    }),
    state.on('document', () => {
      updateStatusBar();
      refreshNotes();
      if (state.viewMode !== 'normal' && state.viewMode !== 'notes') renderMain();
    }),
    state.on('view', () => {
      updateStatusBar();
      renderMain();
    }),
  ];

  updateStatusBar();
  refreshNotes();
  renderMain();

  return {
    state,
    el: root,
    toolbar,
    slidePanel,
    canvas,
    canvasHost,
    altView,
    statusBar,
    notesPane,
    destroy(): void {
      for (const unsub of unsubs) unsub();
      doc.removeEventListener('keydown', onKeyDown);
      altView.removeEventListener('click', onAltViewClick);
      notesPane.removeEventListener('change', onNotesChange);
      toolbar.destroy();
      slidePanel.destroy();
      canvas.destroy();
      root.remove();
    },
  };
}
