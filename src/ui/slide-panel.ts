/**
 * SlidePanel: vertical list of slide entries with section headers. Each entry
 * shows its slide number and title, carries data-slide-id, gets class
 * 'selected' when current, and has per-slide context action buttons
 * (duplicate, delete, move up, move down, hide). Clicking an entry selects
 * that slide. Reordering: `moveSlide(fromIndex, toIndex)` is the drag-reorder
 * API; entries are also wired to native HTML drag & drop when available.
 */

import type { EditorState } from './state';
import { slideTitleText } from './element-dom';

const PANEL_ACTIONS: { action: string; label: string }[] = [
  { action: 'duplicate', label: 'Duplicate' },
  { action: 'delete', label: 'Delete' },
  { action: 'move-up', label: 'Move Up' },
  { action: 'move-down', label: 'Move Down' },
  { action: 'hide', label: 'Hide' },
];

export class SlidePanel {
  readonly el: HTMLElement;

  private readonly state: EditorState;
  private readonly unsubs: (() => void)[] = [];
  private dragFromIndex: number | null = null;

  constructor(parent: HTMLElement, state: EditorState) {
    this.state = state;
    this.el = document.createElement('div');
    this.el.className = 'slide-panel';
    this.el.addEventListener('click', this.onClick);
    this.el.addEventListener('dragstart', this.onDragStart);
    this.el.addEventListener('dragover', this.onDragOver);
    this.el.addEventListener('drop', this.onDrop);
    this.unsubs.push(state.on('document', () => this.render()));
    this.unsubs.push(state.on('slide', () => this.render()));
    parent.appendChild(this.el);
    this.render();
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.el.removeEventListener('click', this.onClick);
    this.el.removeEventListener('dragstart', this.onDragStart);
    this.el.removeEventListener('dragover', this.onDragOver);
    this.el.removeEventListener('drop', this.onDrop);
    this.el.remove();
  }

  /** Drag-reorder API: move the slide at fromIndex to toIndex. */
  moveSlide(fromIndex: number, toIndex: number): void {
    const slide = this.state.presentation.slides[fromIndex];
    if (!slide) return;
    this.state.moveSlideTo(slide.id, toIndex);
  }

  // --- internal ----------------------------------------------------------------

  private render(): void {
    this.el.innerHTML = '';
    const { presentation, currentSlideId } = this.state;
    presentation.slides.forEach((slide, index) => {
      const section = presentation.sections.find((s) => s.slideIds[0] === slide.id);
      if (section) {
        const header = document.createElement('div');
        header.className = 'section-header';
        header.dataset.sectionId = section.id;
        header.textContent = section.name;
        this.el.appendChild(header);
      }

      const entry = document.createElement('div');
      entry.className = 'slide-entry';
      entry.dataset.slideId = slide.id;
      entry.dataset.slideIndex = String(index);
      entry.draggable = true;
      if (slide.id === currentSlideId) entry.classList.add('selected');
      if (slide.hidden) entry.classList.add('hidden-slide');

      const number = document.createElement('span');
      number.className = 'slide-number';
      number.textContent = String(index + 1);
      entry.appendChild(number);

      const title = document.createElement('span');
      title.className = 'slide-title';
      title.textContent = slideTitleText(slide);
      entry.appendChild(title);

      const actions = document.createElement('span');
      actions.className = 'slide-actions';
      for (const spec of PANEL_ACTIONS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.panelAction = spec.action;
        button.textContent = spec.label;
        button.title = spec.label;
        actions.appendChild(button);
      }
      entry.appendChild(actions);
      this.el.appendChild(entry);
    });
  }

  private entryIndex(target: EventTarget | null): number | null {
    const entry = (target as HTMLElement | null)?.closest('[data-slide-index]') as
      | HTMLElement
      | null;
    if (!entry) return null;
    return Number.parseInt(entry.dataset.slideIndex as string, 10);
  }

  private readonly onDragStart = (event: DragEvent): void => {
    this.dragFromIndex = this.entryIndex(event.target);
  };

  private readonly onDragOver = (event: DragEvent): void => {
    if (this.dragFromIndex !== null) event.preventDefault();
  };

  private readonly onDrop = (event: DragEvent): void => {
    const to = this.entryIndex(event.target);
    if (this.dragFromIndex !== null && to !== null && to !== this.dragFromIndex) {
      this.moveSlide(this.dragFromIndex, to);
    }
    this.dragFromIndex = null;
    event.preventDefault();
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const entry = target.closest('[data-slide-id]') as HTMLElement | null;
    if (!entry) return;
    const slideId = entry.dataset.slideId as string;

    const button = target.closest('button[data-panel-action]') as HTMLButtonElement | null;
    if (!button) {
      this.state.selectSlide(slideId);
      return;
    }
    switch (button.dataset.panelAction) {
      case 'duplicate': this.state.duplicateSlideById(slideId); break;
      case 'delete': this.state.deleteSlideById(slideId); break;
      case 'move-up': this.state.moveSlideBy(slideId, 'up'); break;
      case 'move-down': this.state.moveSlideBy(slideId, 'down'); break;
      case 'hide': this.state.toggleSlideHidden(slideId); break;
      default: break;
    }
  };
}
