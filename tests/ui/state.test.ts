// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { EditorState } from '../../src/ui';
import { createPresentation, addSection, getSlideIndex } from '../../src/model';
import { createShape } from '../../src/shapes';
import { getBodyText } from '../../src/text';
import { builtInThemes } from '../../src/style';
import type { ShapeElement, TextBoxElement } from '../../src/core/types';

function fresh(): EditorState {
  return new EditorState();
}

describe('EditorState: construction & selection', () => {
  it('starts with one slide selected and an empty element selection', () => {
    const state = fresh();
    expect(state.presentation.slides.length).toBe(1);
    expect(state.currentSlideId).toBe(state.presentation.slides[0].id);
    expect(state.selection.elementIds).toEqual([]);
    expect(state.viewMode).toBe('normal');
    expect(state.zoom).toBe(1);
  });

  it('selectElements / addToSelection / clearSelection transitions', () => {
    const state = fresh();
    const a = state.insertShape('rectangle');
    const b = state.insertShape('ellipse');
    state.selectElements([a.id]);
    expect(state.selection.elementIds).toEqual([a.id]);
    state.addToSelection(b.id);
    expect(state.selection.elementIds).toEqual([a.id, b.id]);
    state.addToSelection(b.id); // no duplicate
    expect(state.selection.elementIds).toEqual([a.id, b.id]);
    state.clearSelection();
    expect(state.selection.elementIds).toEqual([]);
  });

  it('toggleInSelection adds then removes an id', () => {
    const state = fresh();
    const a = state.insertShape();
    state.clearSelection();
    state.toggleInSelection(a.id);
    expect(state.selection.elementIds).toEqual([a.id]);
    state.toggleInSelection(a.id);
    expect(state.selection.elementIds).toEqual([]);
  });

  it('selectAllOnSlide selects every top-level element', () => {
    const state = fresh();
    state.insertShape();
    state.insertShape();
    state.selectAllOnSlide();
    expect(state.selection.elementIds.length).toBe(
      state.currentSlide()!.elements.length,
    );
  });

  it('emits selection events and supports unsubscribe', () => {
    const state = fresh();
    let calls = 0;
    const off = state.on('selection', () => {
      calls += 1;
    });
    const a = state.insertShape();
    state.clearSelection();
    const seen = calls;
    off();
    state.selectElements([a.id]);
    expect(calls).toBe(seen);
    expect(seen).toBeGreaterThan(0);
  });
});

describe('EditorState: element insertion', () => {
  it('insertShape adds to the current slide and selects it', () => {
    const state = fresh();
    const before = state.currentSlide()!.elements.length;
    const el = state.insertShape('rectangle');
    expect(state.currentSlide()!.elements.length).toBe(before + 1);
    expect(state.selection.elementIds).toEqual([el.id]);
    expect(el.type).toBe('shape');
  });

  it('inserts each element kind with the right type, centered on the slide', () => {
    const state = fresh();
    const kinds: [string, () => { type: string; transform: { x: number; width: number } }][] = [
      ['textbox', () => state.insertTextBox('Hi')],
      ['picture', () => state.insertPicture('img.png')],
      ['table', () => state.insertTable(2, 2)],
      ['chart', () => state.insertChart('pie')],
      ['line', () => state.insertLine()],
    ];
    for (const [type, insert] of kinds) {
      const el = insert();
      expect(el.type).toBe(type);
      expect(el.transform.x).toBeCloseTo(
        (state.presentation.slideSize.width - el.transform.width) / 2,
      );
      expect(state.selection.elementIds).toEqual([(el as { id: string } & object).id]);
    }
  });

  it('deleteSelection removes elements and their animations', () => {
    const state = fresh();
    const el = state.insertShape();
    state.addAnimationToSelection('entrance', 'fade');
    expect(state.currentAnimations().length).toBe(1);
    state.deleteSelection();
    expect(state.currentSlide()!.elements.some((e) => e.id === el.id)).toBe(false);
    expect(state.currentAnimations().length).toBe(0);
    expect(state.selection.elementIds).toEqual([]);
  });

  it('duplicateSelection selects the fresh copies', () => {
    const state = fresh();
    const el = state.insertShape();
    state.duplicateSelection();
    expect(state.selection.elementIds.length).toBe(1);
    expect(state.selection.elementIds[0]).not.toBe(el.id);
  });
});

describe('EditorState: transforms & undo/redo', () => {
  it('translateSelection moves elements and round-trips through undo/redo', () => {
    const state = fresh();
    const el = state.insertShape();
    const { x, y } = el.transform;
    state.translateSelection(25, -5);
    expect(el.transform.x).toBe(x + 25);
    expect(el.transform.y).toBe(y - 5);
    state.undo();
    const restored = state.currentSlide()!.elements.find((e) => e.id === el.id)!;
    expect(restored.transform.x).toBe(x);
    state.redo();
    const redone = state.currentSlide()!.elements.find((e) => e.id === el.id)!;
    expect(redone.transform.x).toBe(x + 25);
  });

  it('resizeElementTo resizes about the anchor as one undo step', () => {
    const state = fresh();
    const el = state.insertShape();
    const orig = { ...el.transform };
    state.resizeElementTo(el.id, orig.width + 40, orig.height + 20, 'topLeft');
    const resized = state.currentSlide()!.elements.find((e) => e.id === el.id)!;
    expect(resized.transform.width).toBe(orig.width + 40);
    expect(resized.transform.x).toBe(orig.x);
    state.undo();
    const undone = state.currentSlide()!.elements.find((e) => e.id === el.id)!;
    expect(undone.transform.width).toBe(orig.width);
  });

  it('setRotationOf rotates one element, undoable', () => {
    const state = fresh();
    const el = state.insertShape();
    state.setRotationOf(el.id, 45);
    expect(state.currentSlide()!.elements.find((e) => e.id === el.id)!.transform.rotation).toBe(45);
    state.undo();
    expect(state.currentSlide()!.elements.find((e) => e.id === el.id)!.transform.rotation).toBe(0);
  });

  it('undo of insertion clears the element; canUndo/canRedo track state', () => {
    const state = fresh();
    expect(state.canUndo).toBe(false);
    const el = state.insertShape();
    expect(state.canUndo).toBe(true);
    state.undo();
    expect(state.currentSlide()!.elements.some((e) => e.id === el.id)).toBe(false);
    expect(state.canRedo).toBe(true);
    state.redo();
    expect(state.currentSlide()!.elements.some((e) => e.id === el.id)).toBe(true);
  });
});

describe('EditorState: clipboard', () => {
  it('copy + paste selects pasted copies with new ids, offset by 12pt', () => {
    const state = fresh();
    const el = state.insertShape();
    state.copy();
    state.paste();
    expect(state.selection.elementIds.length).toBe(1);
    const pastedId = state.selection.elementIds[0];
    expect(pastedId).not.toBe(el.id);
    const pasted = state.currentSlide()!.elements.find((e) => e.id === pastedId)!;
    expect(pasted.transform.x).toBeCloseTo(el.transform.x + 12);
    expect(pasted.transform.y).toBeCloseTo(el.transform.y + 12);
  });

  it('cut removes the selection; paste brings a copy back', () => {
    const state = fresh();
    const el = state.insertShape();
    const count = state.currentSlide()!.elements.length;
    state.cut();
    expect(state.currentSlide()!.elements.length).toBe(count - 1);
    state.paste();
    expect(state.currentSlide()!.elements.length).toBe(count);
    expect(state.selection.elementIds[0]).not.toBe(el.id);
  });
});

describe('EditorState: text formatting', () => {
  it('applyTextFormat toggles bold and selectionHasFormat reflects it', () => {
    const state = fresh();
    state.insertTextBox('Hello');
    expect(state.selectionHasFormat('bold')).toBe(false);
    state.applyTextFormat('bold');
    expect(state.selectionHasFormat('bold')).toBe(true);
    state.applyTextFormat('bold');
    expect(state.selectionHasFormat('bold')).toBe(false);
  });

  it('setFontSize / setFontColor / setFontFamily patch every run', () => {
    const state = fresh();
    const box = state.insertTextBox('Hello') as TextBoxElement;
    state.setFontSize(30);
    state.setFontColor({ type: 'rgb', value: 'FF0000' });
    state.setFontFamily('Georgia');
    const run = box.textBody.paragraphs[0].children[0];
    expect(run.type).toBe('run');
    if (run.type === 'run') {
      expect(run.font.size).toBe(30);
      expect(run.font.color).toEqual({ type: 'rgb', value: 'FF0000' });
      expect(run.font.family).toBe('Georgia');
    }
  });

  it('setTextAlignment sets every paragraph', () => {
    const state = fresh();
    const box = state.insertTextBox('Hello') as TextBoxElement;
    state.setTextAlignment('center');
    expect(box.textBody.paragraphs.every((p) => p.align === 'center')).toBe(true);
  });

  it('toggleBullets and toggleNumbering flip list formatting', () => {
    const state = fresh();
    const box = state.insertTextBox('Item') as TextBoxElement;
    state.toggleBullets();
    expect(box.textBody.paragraphs[0].bullet.type).toBe('char');
    state.toggleBullets();
    expect(box.textBody.paragraphs[0].bullet.type).toBe('none');
    state.toggleNumbering();
    expect(box.textBody.paragraphs[0].bullet.type).toBe('number');
  });
});

describe('EditorState: fill, line, theme, transitions', () => {
  it('setFillForSelection applies a fill to shapes, undoable', () => {
    const state = fresh();
    const el = state.insertShape() as ShapeElement;
    state.setFillForSelection({ type: 'solid', color: { type: 'rgb', value: '00FF00' } });
    expect(el.fill).toEqual({ type: 'solid', color: { type: 'rgb', value: '00FF00' } });
    state.undo();
    const undone = state.currentSlide()!.elements.find((e) => e.id === el.id) as ShapeElement;
    expect(undone.fill).not.toEqual({ type: 'solid', color: { type: 'rgb', value: '00FF00' } });
  });

  it('setLineForSelection patches line style', () => {
    const state = fresh();
    const el = state.insertShape() as ShapeElement;
    state.setLineForSelection({ width: 5, dash: 'dash' });
    expect(el.line.width).toBe(5);
    expect(el.line.dash).toBe('dash');
  });

  it('setTheme swaps the presentation theme and is undoable', () => {
    const state = fresh();
    const target = builtInThemes()[1];
    const originalName = state.presentation.themes[0].name;
    state.setTheme(target.name);
    expect(state.presentation.themes[0].name).toBe(target.name);
    state.undo();
    expect(state.presentation.themes[0].name).toBe(originalName);
    expect(() => state.setTheme('no-such-theme')).toThrow();
  });

  it('setTransitionForCurrent patches the slide transition', () => {
    const state = fresh();
    state.setTransitionForCurrent({ kind: 'fade', duration: 700 });
    expect(state.currentSlide()!.transition.kind).toBe('fade');
    expect(state.currentSlide()!.transition.duration).toBe(700);
  });

  it('addAnimationToSelection / removeAnimationById manage slide animations', () => {
    const state = fresh();
    const el = state.insertShape();
    const [anim] = state.addAnimationToSelection('entrance', 'flyIn', { duration: 300 });
    expect(anim.targetElementId).toBe(el.id);
    expect(state.currentAnimations().length).toBe(1);
    state.removeAnimationById(anim.id);
    expect(state.currentAnimations().length).toBe(0);
    state.undo();
    expect(state.currentAnimations().length).toBe(1);
  });
});

describe('EditorState: slide operations', () => {
  it('addSlideAfterCurrent inserts after the current slide and selects it', () => {
    const state = fresh();
    const firstId = state.currentSlideId;
    const newId = state.addSlideAfterCurrent();
    expect(state.presentation.slides.length).toBe(2);
    expect(state.presentation.slides[1].id).toBe(newId);
    expect(state.currentSlideId).toBe(newId);
    state.undo();
    expect(state.presentation.slides.length).toBe(1);
    expect(state.currentSlideId).toBe(firstId);
  });

  it('deleteSlideById refuses to delete the last slide, else reselects', () => {
    const state = fresh();
    state.deleteSlideById(state.currentSlideId);
    expect(state.presentation.slides.length).toBe(1);
    const secondId = state.addSlideAfterCurrent();
    state.deleteSlideById(secondId);
    expect(state.presentation.slides.length).toBe(1);
    expect(state.currentSlideId).toBe(state.presentation.slides[0].id);
  });

  it('duplicateSlideById selects the duplicate right after the source', () => {
    const state = fresh();
    const sourceId = state.currentSlideId;
    const copyId = state.duplicateSlideById(sourceId);
    expect(copyId).not.toBeNull();
    expect(state.presentation.slides[1].id).toBe(copyId);
    expect(state.currentSlideId).toBe(copyId);
  });

  it('moveSlideTo reorders slides (drag-reorder API)', () => {
    const state = fresh();
    const a = state.currentSlideId;
    state.addSlideAfterCurrent();
    state.addSlideAfterCurrent();
    state.moveSlideTo(a, 2);
    expect(getSlideIndex(state.presentation, a)).toBe(2);
    state.undo();
    expect(getSlideIndex(state.presentation, a)).toBe(0);
  });

  it('toggleSlideHidden flips hidden', () => {
    const state = fresh();
    state.toggleSlideHidden(state.currentSlideId);
    expect(state.currentSlide()!.hidden).toBe(true);
    state.toggleSlideHidden(state.currentSlideId);
    expect(state.currentSlide()!.hidden).toBe(false);
  });

  it('setNotesForCurrent stores notes text', () => {
    const state = fresh();
    state.setNotesForCurrent('Remember the demo');
    expect(state.notesTextForCurrent()).toBe('Remember the demo');
    state.undo();
    expect(state.notesTextForCurrent()).toBe('');
  });
});

describe('EditorState: find & replace', () => {
  it('counts matches across the deck without replacement', () => {
    const state = fresh();
    state.insertTextBox('Hello world');
    state.addSlideAfterCurrent();
    state.insertTextBox('hello again, hello');
    expect(state.findReplace('hello')).toBe(3);
    expect(state.findReplace('hello', undefined, { matchCase: true })).toBe(2);
    expect(state.findReplace('')).toBe(0);
  });

  it('replaces across the deck as a single undo step', () => {
    const state = fresh();
    const first = state.insertTextBox('foo and foo') as TextBoxElement;
    state.addSlideAfterCurrent();
    const second = state.insertTextBox('more foo') as TextBoxElement;
    const count = state.findReplace('foo', 'bar');
    expect(count).toBe(3);
    expect(getBodyText(first.textBody)).toBe('bar and bar');
    expect(getBodyText(second.textBody)).toBe('more bar');
    state.undo();
    const restored = state.presentation.slides
      .flatMap((s) => s.elements)
      .find((e) => e.id === second.id) as TextBoxElement;
    expect(getBodyText(restored.textBody)).toBe('more foo');
    const restoredFirst = state.presentation.slides
      .flatMap((s) => s.elements)
      .find((e) => e.id === first.id) as TextBoxElement;
    expect(getBodyText(restoredFirst.textBody)).toBe('foo and foo');
  });
});

describe('EditorState: view, zoom & slideshow', () => {
  it('setViewMode and setZoom clamp and emit view events', () => {
    const state = fresh();
    let views = 0;
    state.on('view', () => {
      views += 1;
    });
    state.setViewMode('sorter');
    expect(state.viewMode).toBe('sorter');
    state.setZoom(10);
    expect(state.zoom).toBe(4);
    state.setZoom(0.01);
    expect(state.zoom).toBe(0.1);
    expect(views).toBe(3);
  });

  it('startSlideshow enters reading mode from the current slide', () => {
    const state = fresh();
    state.addSlideAfterCurrent(); // current = slide 2
    const show = state.startSlideshow();
    expect(state.activeShow).toBe(show);
    expect(state.viewMode).toBe('reading');
    expect(show.current().slideNumber).toBe(2);
  });

  it('slideshowNext / slideshowPrev navigate; stepping past the end ends the show', () => {
    const state = fresh();
    state.addSlideAfterCurrent();
    state.selectSlide(state.presentation.slides[0].id);
    state.startSlideshow();
    state.slideshowNext();
    expect(state.activeShow!.current().slideNumber).toBe(2);
    state.slideshowPrev();
    expect(state.activeShow!.current().slideNumber).toBe(1);
    state.slideshowNext();
    state.slideshowNext(); // past the last slide
    expect(state.activeShow).toBeNull();
    expect(state.viewMode).toBe('normal');
  });

  it('hidden slides are skipped by the slideshow', () => {
    const state = fresh();
    const secondId = state.addSlideAfterCurrent();
    state.addSlideAfterCurrent();
    state.toggleSlideHidden(secondId);
    state.selectSlide(state.presentation.slides[0].id);
    const show = state.startSlideshow();
    expect(show.current().totalVisible).toBe(2);
  });
});

describe('EditorState: persistence & grouping', () => {
  it('save/load round-trips the document and resets history', () => {
    const state = fresh();
    state.insertShape();
    state.addSlideAfterCurrent();
    const json = state.save();
    const other = new EditorState();
    other.insertShape();
    other.load(json);
    expect(other.presentation.slides.length).toBe(2);
    expect(other.canUndo).toBe(false);
    expect(other.currentSlideId).toBe(other.presentation.slides[0].id);
  });

  it('newDocument resets to a fresh presentation', () => {
    const state = fresh();
    state.insertShape();
    state.addSlideAfterCurrent();
    state.newDocument();
    expect(state.presentation.slides.length).toBe(1);
    expect(state.canUndo).toBe(false);
    expect(state.selection.elementIds).toEqual([]);
  });

  it('groupSelection / ungroupSelection wrap and unwrap elements', () => {
    const state = fresh();
    const a = state.insertShape();
    const b = state.insertShape();
    state.selectElements([a.id, b.id]);
    state.groupSelection();
    expect(state.selection.elementIds.length).toBe(1);
    const groupId = state.selection.elementIds[0];
    const group = state.currentSlide()!.elements.find((e) => e.id === groupId)!;
    expect(group.type).toBe('group');
    state.ungroupSelection();
    expect(state.selection.elementIds.length).toBe(2);
    expect(state.currentSlide()!.elements.some((e) => e.id === groupId)).toBe(false);
  });

  it('sections survive slide ops (smoke: section metadata is preserved)', () => {
    const pres = createPresentation();
    addSection(pres, 'Intro', 0);
    const state = new EditorState(pres);
    state.addSlideAfterCurrent();
    expect(state.presentation.sections.length).toBe(1);
    expect(state.presentation.sections[0].name).toBe('Intro');
  });
});
