// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, type App } from '../../src/ui';
import { createPresentation, addSection } from '../../src/model';

let container: HTMLElement;
let app: App;

function key(target: EventTarget, k: string, opts: Partial<KeyboardEventInit> = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }),
  );
}

function click(el: Element | null): void {
  (el as HTMLElement).click();
}

function button(action: string): HTMLButtonElement {
  const b = app.el.querySelector(`button[data-action="${action}"]`) as HTMLButtonElement | null;
  if (!b) throw new Error(`button not found: ${action}`);
  return b;
}

beforeEach(() => {
  container = document.createElement('div');
  app = createApp(container);
});

afterEach(() => {
  app.destroy();
});

describe('createApp: assembly', () => {
  it('mounts toolbar, slide panel, canvas, notes pane and status bar', () => {
    expect(container.querySelector('.toolbar')).not.toBeNull();
    expect(container.querySelector('.slide-panel')).not.toBeNull();
    expect(container.querySelector('.editor-canvas')).not.toBeNull();
    expect(container.querySelector('.notes-input')).not.toBeNull();
    expect(container.querySelector('.status-bar')).not.toBeNull();
  });

  it('shows ribbon tabs and switches panels', () => {
    const tabs = Array.from(app.toolbar.el.querySelectorAll('[data-tab]')).map(
      (b) => (b as HTMLElement).textContent,
    );
    expect(tabs).toEqual([
      'Home', 'Insert', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Review', 'View',
    ]);
    const insertTab = app.toolbar.el.querySelector('[data-tab="insert"]') as HTMLElement;
    click(insertTab);
    expect(app.toolbar.currentTab).toBe('insert');
    expect(insertTab.getAttribute('aria-selected')).toBe('true');
    const insertPanel = app.toolbar.el.querySelector('[data-tab-panel="insert"]') as HTMLElement;
    const homePanel = app.toolbar.el.querySelector('[data-tab-panel="home"]') as HTMLElement;
    expect(insertPanel.style.display).not.toBe('none');
    expect(homePanel.style.display).toBe('none');
  });

  it('destroy removes the DOM and detaches key handlers', () => {
    const slides = app.state.presentation.slides.length;
    app.destroy();
    expect(container.querySelector('.app')).toBeNull();
    key(document, 'm', { ctrlKey: true });
    expect(app.state.presentation.slides.length).toBe(slides);
    app = createApp(container); // re-create so afterEach destroy is safe
  });
});

describe('toolbar interactions', () => {
  it('insert Rectangle button adds a shape to the current slide and selects it', () => {
    const before = app.state.currentSlide()!.elements.length;
    click(button('insert-rectangle'));
    const elements = app.state.currentSlide()!.elements;
    expect(elements.length).toBe(before + 1);
    expect(elements[elements.length - 1].type).toBe('shape');
    expect(app.state.selection.elementIds).toEqual([elements[elements.length - 1].id]);
  });

  it('bold button toggles selection formatting and aria-pressed', () => {
    click(button('insert-textbox'));
    const bold = button('bold');
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    click(bold);
    expect(app.state.selectionHasFormat('bold')).toBe(true);
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    click(bold);
    expect(bold.getAttribute('aria-pressed')).toBe('false');
  });

  it('undo/redo buttons track disabled state', () => {
    const undo = button('undo');
    const redo = button('redo');
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    click(button('insert-ellipse'));
    expect(undo.disabled).toBe(false);
    click(undo);
    expect(redo.disabled).toBe(false);
  });

  it('new-slide button adds a slide; theme select applies a theme', () => {
    click(button('new-slide'));
    expect(app.state.presentation.slides.length).toBe(2);
    const themeSelect = app.toolbar.el.querySelector(
      '[data-action="theme-select"]',
    ) as HTMLSelectElement;
    const target = themeSelect.options[1];
    themeSelect.value = target.value;
    themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.state.presentation.themes[0].name).toBe(target.textContent);
  });

  it('transition select updates the current slide transition', () => {
    const select = app.toolbar.el.querySelector(
      '[data-action="transition-select"]',
    ) as HTMLSelectElement;
    select.value = 'fade';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.state.currentSlide()!.transition.kind).toBe('fade');
  });

  it('add-animation applies the selected entrance effect to the selection', () => {
    click(button('insert-rectangle'));
    click(button('add-animation'));
    const anims = app.state.currentAnimations();
    expect(anims.length).toBe(1);
    expect(anims[0].category).toBe('entrance');
  });

  it('find/replace fields drive findReplace and show a count', () => {
    click(button('insert-textbox')); // inserts "Text"
    const findInput = app.toolbar.el.querySelector(
      '[data-action="find-input"]',
    ) as HTMLInputElement;
    const replaceInput = app.toolbar.el.querySelector(
      '[data-action="replace-input"]',
    ) as HTMLInputElement;
    findInput.value = 'Text';
    click(button('find-all'));
    expect(app.toolbar.el.querySelector('.find-count')!.textContent).toBe('1 match');
    replaceInput.value = 'Words';
    click(button('replace-all'));
    expect(app.toolbar.el.querySelector('.find-count')!.textContent).toBe('1 replaced');
    expect(app.state.findReplace('Words')).toBe(1);
  });

  it('font size input applies to the selected text', () => {
    click(button('insert-textbox'));
    const input = app.toolbar.el.querySelector('[data-action="font-size"]') as HTMLInputElement;
    input.value = '40';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const el = app.state.selectedElements()[0];
    if (el.type !== 'textbox') throw new Error('expected textbox');
    const run = el.textBody.paragraphs[0].children[0];
    expect(run.type === 'run' && run.font.size).toBe(40);
  });
});

describe('slide panel', () => {
  it('click on an entry changes the current slide', () => {
    app.state.addSlideAfterCurrent();
    const firstId = app.state.presentation.slides[0].id;
    const entry = app.slidePanel.el.querySelector(
      `[data-slide-id="${firstId}"] .slide-number`,
    ) as HTMLElement;
    click(entry);
    expect(app.state.currentSlideId).toBe(firstId);
  });

  it('context buttons duplicate, hide and delete slides', () => {
    const firstId = app.state.currentSlideId;
    click(app.slidePanel.el.querySelector(`[data-slide-id="${firstId}"] [data-panel-action="duplicate"]`));
    expect(app.state.presentation.slides.length).toBe(2);
    click(app.slidePanel.el.querySelector(`[data-slide-id="${firstId}"] [data-panel-action="hide"]`));
    expect(app.state.presentation.slides[0].hidden).toBe(true);
    click(app.slidePanel.el.querySelector(`[data-slide-id="${firstId}"] [data-panel-action="delete"]`));
    expect(app.state.presentation.slides.length).toBe(1);
    expect(app.state.presentation.slides[0].id).not.toBe(firstId);
  });

  it('moveSlide reorders via the drag-reorder API', () => {
    app.state.addSlideAfterCurrent();
    app.state.addSlideAfterCurrent();
    const [a, b, c] = app.state.presentation.slides.map((s) => s.id);
    app.slidePanel.moveSlide(0, 2);
    expect(app.state.presentation.slides.map((s) => s.id)).toEqual([b, c, a]);
  });

  it('renders section headers before the first slide of each section', () => {
    app.destroy();
    const pres = createPresentation();
    addSection(pres, 'Opening', 0);
    app = createApp(container, { presentation: pres });
    const header = app.slidePanel.el.querySelector('.section-header') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.textContent).toBe('Opening');
    expect(header.nextElementSibling?.classList.contains('slide-entry')).toBe(true);
  });
});

describe('keyboard shortcuts', () => {
  it('Ctrl+Z undoes and Ctrl+Y / Ctrl+Shift+Z redo', () => {
    click(button('insert-rectangle'));
    const count = app.state.currentSlide()!.elements.length;
    key(document, 'z', { ctrlKey: true });
    expect(app.state.currentSlide()!.elements.length).toBe(count - 1);
    key(document, 'y', { ctrlKey: true });
    expect(app.state.currentSlide()!.elements.length).toBe(count);
    key(document, 'z', { ctrlKey: true });
    key(document, 'z', { ctrlKey: true, shiftKey: true });
    expect(app.state.currentSlide()!.elements.length).toBe(count);
  });

  it('Ctrl+M inserts a new slide', () => {
    key(document, 'm', { ctrlKey: true });
    expect(app.state.presentation.slides.length).toBe(2);
  });

  it('Ctrl+C / Ctrl+V copies and pastes the selection', () => {
    click(button('insert-rectangle'));
    const count = app.state.currentSlide()!.elements.length;
    key(document, 'c', { ctrlKey: true });
    key(document, 'v', { ctrlKey: true });
    expect(app.state.currentSlide()!.elements.length).toBe(count + 1);
    expect(app.state.selection.elementIds.length).toBe(1);
  });

  it('Ctrl+D duplicates, Ctrl+A selects all, Delete removes', () => {
    click(button('insert-rectangle'));
    key(document, 'd', { ctrlKey: true });
    const total = app.state.currentSlide()!.elements.length;
    key(document, 'a', { ctrlKey: true });
    expect(app.state.selection.elementIds.length).toBe(total);
    key(document, 'Delete');
    expect(app.state.currentSlide()!.elements.length).toBe(0);
  });

  it('Ctrl+B bolds the selected text box', () => {
    click(button('insert-textbox'));
    key(document, 'b', { ctrlKey: true });
    expect(app.state.selectionHasFormat('bold')).toBe(true);
  });

  it('arrow keys nudge the selection in normal mode', () => {
    click(button('insert-rectangle'));
    const el = app.state.selectedElements()[0];
    const x = el.transform.x;
    key(document, 'ArrowRight');
    key(document, 'ArrowDown', { shiftKey: true });
    expect(el.transform.x).toBe(x + 1);
    expect(el.transform.y).toBeGreaterThan(0);
  });

  it('typing keys inside the notes textarea are not hijacked', () => {
    click(button('insert-rectangle'));
    const count = app.state.currentSlide()!.elements.length;
    app.notesPane.focus();
    key(app.notesPane, 'Delete');
    expect(app.state.currentSlide()!.elements.length).toBe(count);
  });
});

describe('status bar, notes & view modes', () => {
  it('status bar shows slide position and zoom, updating on change', () => {
    const text = () => app.statusBar.textContent as string;
    expect(text()).toContain('Slide 1 of 1');
    expect(text()).toContain('100%');
    app.state.addSlideAfterCurrent();
    expect(text()).toContain('Slide 2 of 2');
    click(button('zoom-in'));
    expect(text()).toContain('125%');
    click(button('zoom-reset'));
    expect(text()).toContain('100%');
  });

  it('notes pane edits store notes on the current slide', () => {
    app.notesPane.value = 'Speaker notes here';
    app.notesPane.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.state.notesTextForCurrent()).toBe('Speaker notes here');
    app.state.addSlideAfterCurrent();
    expect(app.notesPane.value).toBe('');
  });

  it('sorter view renders a thumbnail grid; clicking a thumb selects the slide', () => {
    app.state.addSlideAfterCurrent();
    click(button('view-sorter'));
    expect(app.state.viewMode).toBe('sorter');
    expect(app.canvasHost.style.display).toBe('none');
    const thumbs = app.altView.querySelectorAll('.sorter-thumb');
    expect(thumbs.length).toBe(2);
    expect(button('view-sorter').getAttribute('aria-pressed')).toBe('true');
    const firstId = app.state.presentation.slides[0].id;
    click(app.altView.querySelector(`.sorter-thumb[data-slide-id="${firstId}"]`));
    expect(app.state.currentSlideId).toBe(firstId);
  });

  it('outline view lists slide titles and body text', () => {
    click(button('insert-textbox')); // becomes the fallback title "Text"
    app.state.insertTextBox('Body point');
    click(button('view-outline'));
    const items = app.altView.querySelectorAll('.outline-slide');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.outline-title')!.textContent).toBe('Text');
    const bodies = Array.from(items[0].querySelectorAll('.outline-text')).map(
      (n) => n.textContent,
    );
    expect(bodies).toContain('Body point');
  });

  it('switching back to normal view restores the canvas', () => {
    click(button('view-sorter'));
    click(button('view-normal'));
    expect(app.canvasHost.style.display).not.toBe('none');
    expect(app.altView.style.display).toBe('none');
  });
});

describe('slideshow', () => {
  it('F5 starts the show, arrows advance and go back, Escape ends it', () => {
    app.state.addSlideAfterCurrent();
    app.state.selectSlide(app.state.presentation.slides[0].id);
    key(document, 'F5');
    expect(app.state.activeShow).not.toBeNull();
    expect(app.state.viewMode).toBe('reading');
    expect(app.statusBar.textContent).toContain('Slide 1 of 2');
    key(document, 'ArrowRight');
    expect(app.state.activeShow!.current().slideNumber).toBe(2);
    expect(app.statusBar.textContent).toContain('Slide 2 of 2');
    key(document, 'ArrowLeft');
    expect(app.state.activeShow!.current().slideNumber).toBe(1);
    key(document, 'Escape');
    expect(app.state.activeShow).toBeNull();
    expect(app.state.viewMode).toBe('normal');
  });

  it('reading view renders the current show slide elements', () => {
    app.state.insertShape('rectangle');
    app.state.clearSelection();
    key(document, 'F5');
    const stage = app.altView.querySelector('.reading-slide') as HTMLElement;
    expect(stage).not.toBeNull();
    expect(stage.querySelectorAll('[data-element-id]').length).toBeGreaterThan(0);
    key(document, 'Escape');
  });

  it('advancing past the last slide ends the show', () => {
    key(document, 'F5');
    key(document, 'ArrowRight'); // single slide: past the end
    expect(app.state.activeShow).toBeNull();
    expect(app.state.viewMode).toBe('normal');
  });

  it('toolbar Slide Show tab start/end buttons work', () => {
    click(button('start-show'));
    expect(app.state.activeShow).not.toBeNull();
    click(button('end-show'));
    expect(app.state.activeShow).toBeNull();
  });
});
