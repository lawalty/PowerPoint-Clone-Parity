/**
 * Ribbon-like toolbar. A tab strip (Home, Insert, Design, Transitions,
 * Animations, Slide Show, Review, View) switches between per-tab panels of
 * buttons. Buttons carry data-action attributes and dispatch to EditorState.
 * Stateful buttons reflect the editor: undo/redo disabled states, bold /
 * italic / underline aria-pressed from the selection, and the active view
 * mode pressed on the View tab.
 */

import type { AnimationEffect, TransitionKind, ViewMode } from '../core/types';
import { transitionCatalog } from '../animation';
import { builtInThemes } from '../style';
import type { EditorState, TextToggleKey } from './state';

export const TOOLBAR_TABS = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'design', label: 'Design' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'animations', label: 'Animations' },
  { id: 'slideshow', label: 'Slide Show' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
] as const;

export type ToolbarTabId = (typeof TOOLBAR_TABS)[number]['id'];

interface ButtonSpec {
  action: string;
  label: string;
  /** Toggle buttons expose aria-pressed. */
  toggle?: boolean;
}

const TAB_BUTTONS: Record<ToolbarTabId, ButtonSpec[]> = {
  home: [
    { action: 'new-slide', label: 'New Slide' },
    { action: 'delete-slide', label: 'Delete Slide' },
    { action: 'undo', label: 'Undo' },
    { action: 'redo', label: 'Redo' },
    { action: 'cut', label: 'Cut' },
    { action: 'copy', label: 'Copy' },
    { action: 'paste', label: 'Paste' },
    { action: 'duplicate', label: 'Duplicate' },
    { action: 'bold', label: 'B', toggle: true },
    { action: 'italic', label: 'I', toggle: true },
    { action: 'underline', label: 'U', toggle: true },
    { action: 'bullets', label: 'Bullets' },
    { action: 'numbering', label: 'Numbering' },
    { action: 'align-left', label: 'Left' },
    { action: 'align-center', label: 'Center' },
    { action: 'align-right', label: 'Right' },
    { action: 'align-justify', label: 'Justify' },
    { action: 'group', label: 'Group' },
    { action: 'ungroup', label: 'Ungroup' },
    { action: 'bring-front', label: 'Bring to Front' },
    { action: 'send-back', label: 'Send to Back' },
  ],
  insert: [
    { action: 'insert-rectangle', label: 'Rectangle' },
    { action: 'insert-ellipse', label: 'Ellipse' },
    { action: 'insert-textbox', label: 'Text Box' },
    { action: 'insert-picture', label: 'Picture' },
    { action: 'insert-table', label: 'Table' },
    { action: 'insert-chart', label: 'Chart' },
    { action: 'insert-line', label: 'Line' },
  ],
  design: [],
  transitions: [],
  animations: [{ action: 'add-animation', label: 'Add Animation' }],
  slideshow: [
    { action: 'start-show', label: 'From Current Slide' },
    { action: 'start-show-beginning', label: 'From Beginning' },
    { action: 'show-next', label: 'Next' },
    { action: 'show-prev', label: 'Previous' },
    { action: 'end-show', label: 'End Show' },
  ],
  review: [
    { action: 'find-all', label: 'Find All' },
    { action: 'replace-all', label: 'Replace All' },
  ],
  view: [
    { action: 'view-normal', label: 'Normal', toggle: true },
    { action: 'view-sorter', label: 'Slide Sorter', toggle: true },
    { action: 'view-notes', label: 'Notes Page', toggle: true },
    { action: 'view-reading', label: 'Reading View', toggle: true },
    { action: 'view-outline', label: 'Outline', toggle: true },
    { action: 'zoom-in', label: 'Zoom In' },
    { action: 'zoom-out', label: 'Zoom Out' },
    { action: 'zoom-reset', label: '100%' },
  ],
};

const VIEW_ACTION_TO_MODE: Record<string, ViewMode> = {
  'view-normal': 'normal',
  'view-sorter': 'sorter',
  'view-notes': 'notes',
  'view-reading': 'reading',
  'view-outline': 'outline',
};

export class Toolbar {
  readonly el: HTMLElement;

  private readonly state: EditorState;
  private readonly unsubs: (() => void)[] = [];
  private readonly panels = new Map<ToolbarTabId, HTMLElement>();
  private activeTab: ToolbarTabId = 'home';

  private readonly themeSelect: HTMLSelectElement;
  private readonly layoutSelect: HTMLSelectElement;
  private readonly transitionSelect: HTMLSelectElement;
  private readonly animationSelect: HTMLSelectElement;
  private readonly fontSizeInput: HTMLInputElement;
  private readonly fontColorInput: HTMLInputElement;
  private readonly findInput: HTMLInputElement;
  private readonly replaceInput: HTMLInputElement;
  private readonly findCount: HTMLElement;

  constructor(parent: HTMLElement, state: EditorState) {
    this.state = state;
    this.el = document.createElement('div');
    this.el.className = 'toolbar';

    // Tab strip.
    const strip = document.createElement('div');
    strip.className = 'toolbar-tabs';
    strip.setAttribute('role', 'tablist');
    for (const tab of TOOLBAR_TABS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tab = tab.id;
      button.setAttribute('role', 'tab');
      button.textContent = tab.label;
      strip.appendChild(button);
    }
    this.el.appendChild(strip);

    // Panels.
    const panelHost = document.createElement('div');
    panelHost.className = 'toolbar-panels';
    for (const tab of TOOLBAR_TABS) {
      const panel = document.createElement('div');
      panel.className = 'toolbar-panel';
      panel.dataset.tabPanel = tab.id;
      panel.setAttribute('role', 'tabpanel');
      for (const spec of TAB_BUTTONS[tab.id]) {
        panel.appendChild(this.makeButton(spec));
      }
      this.panels.set(tab.id, panel);
      panelHost.appendChild(panel);
    }
    this.el.appendChild(panelHost);

    // Home tab extras: font size + font color.
    this.fontSizeInput = document.createElement('input');
    this.fontSizeInput.type = 'number';
    this.fontSizeInput.dataset.action = 'font-size';
    this.fontSizeInput.title = 'Font Size';
    this.fontColorInput = document.createElement('input');
    this.fontColorInput.dataset.action = 'font-color';
    this.fontColorInput.title = 'Font Color';
    const home = this.panels.get('home')!;
    home.appendChild(this.fontSizeInput);
    home.appendChild(this.fontColorInput);

    // Design tab extras: theme + layout selects.
    this.themeSelect = document.createElement('select');
    this.themeSelect.dataset.action = 'theme-select';
    for (const theme of builtInThemes()) {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      this.themeSelect.appendChild(option);
    }
    this.layoutSelect = document.createElement('select');
    this.layoutSelect.dataset.action = 'layout-select';
    const design = this.panels.get('design')!;
    design.appendChild(this.themeSelect);
    design.appendChild(this.layoutSelect);

    // Transitions tab extras: transition kind select.
    this.transitionSelect = document.createElement('select');
    this.transitionSelect.dataset.action = 'transition-select';
    for (const meta of transitionCatalog()) {
      const option = document.createElement('option');
      option.value = meta.kind;
      option.textContent = meta.kind;
      this.transitionSelect.appendChild(option);
    }
    this.panels.get('transitions')!.appendChild(this.transitionSelect);

    // Animations tab extras: effect select (entrance effects).
    this.animationSelect = document.createElement('select');
    this.animationSelect.dataset.action = 'animation-select';
    for (const effect of ['appear', 'fade', 'flyIn', 'floatIn', 'wipe', 'zoom'] as const) {
      const option = document.createElement('option');
      option.value = effect;
      option.textContent = effect;
      this.animationSelect.appendChild(option);
    }
    this.panels.get('animations')!.insertBefore(
      this.animationSelect,
      this.panels.get('animations')!.firstChild,
    );

    // Review tab extras: find & replace inputs and result count.
    this.findInput = document.createElement('input');
    this.findInput.dataset.action = 'find-input';
    this.findInput.placeholder = 'Find';
    this.replaceInput = document.createElement('input');
    this.replaceInput.dataset.action = 'replace-input';
    this.replaceInput.placeholder = 'Replace with';
    this.findCount = document.createElement('span');
    this.findCount.className = 'find-count';
    const review = this.panels.get('review')!;
    review.insertBefore(this.replaceInput, review.firstChild);
    review.insertBefore(this.findInput, review.firstChild);
    review.appendChild(this.findCount);

    this.el.addEventListener('click', this.onClick);
    this.el.addEventListener('change', this.onChange);

    this.unsubs.push(state.history.onChange(() => this.updateHistoryButtons()));
    this.unsubs.push(state.on('document', () => {
      this.refreshSelects();
      this.updateToggleButtons();
    }));
    this.unsubs.push(state.on('selection', () => this.updateToggleButtons()));
    this.unsubs.push(state.on('slide', () => this.syncSlideControls()));
    this.unsubs.push(state.on('view', () => this.updateViewButtons()));

    parent.appendChild(this.el);
    this.selectTab('home');
    this.updateHistoryButtons();
    this.refreshSelects();
    this.updateToggleButtons();
    this.updateViewButtons();
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.el.removeEventListener('click', this.onClick);
    this.el.removeEventListener('change', this.onChange);
    this.el.remove();
  }

  /** Show the panel for the given ribbon tab. */
  selectTab(tabId: ToolbarTabId): void {
    this.activeTab = tabId;
    for (const tabButton of Array.from(this.el.querySelectorAll('[data-tab]'))) {
      const button = tabButton as HTMLElement;
      const active = button.dataset.tab === tabId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    for (const [id, panel] of this.panels) {
      panel.style.display = id === tabId ? '' : 'none';
    }
  }

  get currentTab(): ToolbarTabId {
    return this.activeTab;
  }

  // --- internal ---------------------------------------------------------------

  private makeButton(spec: ButtonSpec): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = spec.action;
    button.textContent = spec.label;
    button.title = spec.label;
    if (spec.toggle) button.setAttribute('aria-pressed', 'false');
    return button;
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const tabButton = target?.closest('button[data-tab]') as HTMLElement | null;
    if (tabButton) {
      this.selectTab(tabButton.dataset.tab as ToolbarTabId);
      return;
    }
    const button = target?.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button || button.disabled) return;
    this.dispatch(button.dataset.action as string);
  };

  private readonly onChange = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    switch ((target as HTMLElement | null)?.dataset.action) {
      case 'theme-select':
        this.state.setTheme(this.themeSelect.value);
        break;
      case 'layout-select':
        this.state.setSlideLayout(this.layoutSelect.value);
        break;
      case 'transition-select':
        this.state.setTransitionForCurrent({
          kind: this.transitionSelect.value as TransitionKind,
        });
        break;
      case 'font-size': {
        const size = Number.parseFloat(this.fontSizeInput.value);
        if (Number.isFinite(size) && size > 0) this.state.setFontSize(size);
        break;
      }
      case 'font-color': {
        const hex = this.fontColorInput.value.replace(/^#/, '').toUpperCase();
        if (/^[0-9A-F]{6}$/.test(hex)) {
          this.state.setFontColor({ type: 'rgb', value: hex });
        }
        break;
      }
      default:
        break;
    }
  };

  private dispatch(action: string): void {
    const state = this.state;
    const viewMode = VIEW_ACTION_TO_MODE[action];
    if (viewMode) {
      state.setViewMode(viewMode);
      return;
    }
    switch (action) {
      case 'new-slide': state.addSlideAfterCurrent(); break;
      case 'delete-slide': state.deleteCurrentSlide(); break;
      case 'undo': state.undo(); break;
      case 'redo': state.redo(); break;
      case 'cut': state.cut(); break;
      case 'copy': state.copy(); break;
      case 'paste': state.paste(); break;
      case 'duplicate': state.duplicateSelection(); break;
      case 'bold': state.applyTextFormat('bold'); break;
      case 'italic': state.applyTextFormat('italic'); break;
      case 'underline': state.applyTextFormat('underline'); break;
      case 'bullets': state.toggleBullets(); break;
      case 'numbering': state.toggleNumbering(); break;
      case 'align-left': state.setTextAlignment('left'); break;
      case 'align-center': state.setTextAlignment('center'); break;
      case 'align-right': state.setTextAlignment('right'); break;
      case 'align-justify': state.setTextAlignment('justify'); break;
      case 'insert-rectangle': state.insertShape('rectangle'); break;
      case 'insert-ellipse': state.insertShape('ellipse'); break;
      case 'insert-textbox': state.insertTextBox('Text'); break;
      case 'insert-picture': state.insertPicture('picture.png'); break;
      case 'insert-table': state.insertTable(3, 3); break;
      case 'insert-chart': state.insertChart('column'); break;
      case 'insert-line': state.insertLine(); break;
      case 'group': state.groupSelection(); break;
      case 'ungroup': state.ungroupSelection(); break;
      case 'bring-front': state.reorder('front'); break;
      case 'send-back': state.reorder('back'); break;
      case 'add-animation':
        state.addAnimationToSelection(
          'entrance',
          (this.animationSelect.value || 'fade') as AnimationEffect,
        );
        break;
      case 'start-show': state.startSlideshow(); break;
      case 'start-show-beginning': {
        const first = state.presentation.slides.find((s) => !s.hidden);
        if (first) state.selectSlide(first.id);
        state.startSlideshow();
        break;
      }
      case 'show-next': state.slideshowNext(); break;
      case 'show-prev': state.slideshowPrev(); break;
      case 'end-show': state.endSlideshow(); break;
      case 'find-all': {
        const count = state.findReplace(this.findInput.value);
        this.findCount.textContent = `${count} match${count === 1 ? '' : 'es'}`;
        break;
      }
      case 'replace-all': {
        const count = state.findReplace(this.findInput.value, this.replaceInput.value);
        this.findCount.textContent = `${count} replaced`;
        break;
      }
      case 'zoom-in': state.setZoom(state.zoom * 1.25); break;
      case 'zoom-out': state.setZoom(state.zoom / 1.25); break;
      case 'zoom-reset': state.setZoom(1); break;
      default: break;
    }
  }

  private button(action: string): HTMLButtonElement | null {
    return this.el.querySelector(`button[data-action="${action}"]`);
  }

  private updateHistoryButtons(): void {
    const undoButton = this.button('undo');
    const redoButton = this.button('redo');
    if (undoButton) undoButton.disabled = !this.state.canUndo;
    if (redoButton) redoButton.disabled = !this.state.canRedo;
  }

  private updateToggleButtons(): void {
    for (const key of ['bold', 'italic', 'underline'] as TextToggleKey[]) {
      const button = this.button(key);
      if (button) {
        button.setAttribute('aria-pressed', String(this.state.selectionHasFormat(key)));
      }
    }
  }

  private updateViewButtons(): void {
    for (const [action, mode] of Object.entries(VIEW_ACTION_TO_MODE)) {
      const button = this.button(action);
      if (button) {
        button.setAttribute('aria-pressed', String(this.state.viewMode === mode));
      }
    }
  }

  /** Rebuild the layout options (layouts can change on load/new document). */
  private refreshSelects(): void {
    const layouts = this.state.presentation.layouts;
    this.layoutSelect.innerHTML = '';
    for (const layout of layouts) {
      const option = document.createElement('option');
      option.value = layout.id;
      option.textContent = layout.name;
      this.layoutSelect.appendChild(option);
    }
    this.syncSlideControls();
  }

  private syncSlideControls(): void {
    const slide = this.state.currentSlide();
    if (!slide) return;
    this.layoutSelect.value = slide.layoutId;
    this.transitionSelect.value = slide.transition.kind;
  }
}
