/**
 * SlidePanel: vertical list of slide entries. Each entry shows its slide
 * number, carries data-slide-id, gets class 'selected' when current, and has
 * per-slide context action buttons (duplicate, delete, move up, move down,
 * hide). Clicking an entry selects that slide.
 */

import type { EditorState } from './state';

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

  constructor(parent: HTMLElement, state: EditorState) {
    this.state = state;
    this.el = document.createElement('div');
    this.el.className = 'slide-panel';
    this.el.addEventListener('click', this.onClick);
    this.unsubs.push(state.on('document', () => this.render()));
    this.unsubs.push(state.on('slide', () => this.render()));
    parent.appendChild(this.el);
    this.render();
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.el.removeEventListener('click', this.onClick);
    this.el.remove();
  }

  // --- internal ----------------------------------------------------------------

  private render(): void {
    this.el.innerHTML = '';
    const { presentation, currentSlideId } = this.state;
    presentation.slides.forEach((slide, index) => {
      const entry = document.createElement('div');
      entry.className = 'slide-entry';
      entry.dataset.slideId = slide.id;
      if (slide.id === currentSlideId) entry.classList.add('selected');
      if (slide.hidden) entry.classList.add('hidden-slide');

      const number = document.createElement('span');
      number.className = 'slide-number';
      number.textContent = String(index + 1);
      entry.appendChild(number);

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
