/**
 * Toolbar component: buttons with data-action attributes that dispatch to
 * EditorState, a theme <select> of the built-in themes, and a layout <select>
 * of the presentation's layouts. Undo/redo buttons mirror canUndo/canRedo.
 */

import { builtInThemes } from '../style';
import type { EditorState } from './state';

interface ButtonSpec {
  action: string;
  label: string;
}

const BUTTONS: ButtonSpec[] = [
  { action: 'new-slide', label: 'New Slide' },
  { action: 'delete-slide', label: 'Delete Slide' },
  { action: 'undo', label: 'Undo' },
  { action: 'redo', label: 'Redo' },
  { action: 'cut', label: 'Cut' },
  { action: 'copy', label: 'Copy' },
  { action: 'paste', label: 'Paste' },
  { action: 'bold', label: 'B' },
  { action: 'italic', label: 'I' },
  { action: 'underline', label: 'U' },
  { action: 'align-left', label: 'Left' },
  { action: 'align-center', label: 'Center' },
  { action: 'align-right', label: 'Right' },
  { action: 'insert-rectangle', label: 'Rectangle' },
  { action: 'insert-ellipse', label: 'Ellipse' },
  { action: 'insert-textbox', label: 'Text Box' },
  { action: 'insert-picture', label: 'Picture' },
  { action: 'insert-table', label: 'Table' },
  { action: 'insert-chart', label: 'Chart' },
  { action: 'insert-line', label: 'Line' },
  { action: 'group', label: 'Group' },
  { action: 'ungroup', label: 'Ungroup' },
  { action: 'bring-front', label: 'Bring to Front' },
  { action: 'send-back', label: 'Send to Back' },
  { action: 'start-show', label: 'Slideshow' },
];

export class Toolbar {
  readonly el: HTMLElement;

  private readonly state: EditorState;
  private readonly unsubs: (() => void)[] = [];
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly themeSelect: HTMLSelectElement;
  private readonly layoutSelect: HTMLSelectElement;

  constructor(parent: HTMLElement, state: EditorState) {
    this.state = state;
    this.el = document.createElement('div');
    this.el.className = 'toolbar';

    for (const spec of BUTTONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = spec.action;
      button.textContent = spec.label;
      button.title = spec.label;
      this.el.appendChild(button);
    }
    this.undoButton = this.el.querySelector('button[data-action="undo"]') as HTMLButtonElement;
    this.redoButton = this.el.querySelector('button[data-action="redo"]') as HTMLButtonElement;

    this.themeSelect = document.createElement('select');
    this.themeSelect.dataset.action = 'theme-select';
    for (const theme of builtInThemes()) {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      this.themeSelect.appendChild(option);
    }
    this.el.appendChild(this.themeSelect);

    this.layoutSelect = document.createElement('select');
    this.layoutSelect.dataset.action = 'layout-select';
    this.el.appendChild(this.layoutSelect);

    this.el.addEventListener('click', this.onClick);
    this.themeSelect.addEventListener('change', this.onThemeChange);
    this.layoutSelect.addEventListener('change', this.onLayoutChange);

    this.unsubs.push(state.history.onChange(() => this.updateHistoryButtons()));
    this.unsubs.push(state.on('document', () => this.refreshSelects()));
    this.unsubs.push(state.on('slide', () => this.syncLayoutValue()));

    parent.appendChild(this.el);
    this.updateHistoryButtons();
    this.refreshSelects();
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.el.removeEventListener('click', this.onClick);
    this.themeSelect.removeEventListener('change', this.onThemeChange);
    this.layoutSelect.removeEventListener('change', this.onLayoutChange);
    this.el.remove();
  }

  // --- internal ---------------------------------------------------------------

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button || button.disabled) return;
    this.dispatch(button.dataset.action as string);
  };

  private readonly onThemeChange = (): void => {
    this.state.setTheme(this.themeSelect.value);
  };

  private readonly onLayoutChange = (): void => {
    this.state.setSlideLayout(this.layoutSelect.value);
  };

  private dispatch(action: string): void {
    const state = this.state;
    switch (action) {
      case 'new-slide': state.addSlideAfterCurrent(); break;
      case 'delete-slide': state.deleteCurrentSlide(); break;
      case 'undo': state.undo(); break;
      case 'redo': state.redo(); break;
      case 'cut': state.cut(); break;
      case 'copy': state.copy(); break;
      case 'paste': state.paste(); break;
      case 'bold': state.applyTextFormat('bold'); break;
      case 'italic': state.applyTextFormat('italic'); break;
      case 'underline': state.applyTextFormat('underline'); break;
      case 'align-left': state.setTextAlignment('left'); break;
      case 'align-center': state.setTextAlignment('center'); break;
      case 'align-right': state.setTextAlignment('right'); break;
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
      case 'start-show': state.startSlideshow(); break;
      default: break;
    }
  }

  private updateHistoryButtons(): void {
    this.undoButton.disabled = !this.state.canUndo;
    this.redoButton.disabled = !this.state.canRedo;
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
    this.syncLayoutValue();
  }

  private syncLayoutValue(): void {
    const slide = this.state.currentSlide();
    if (slide) this.layoutSelect.value = slide.layoutId;
  }
}
