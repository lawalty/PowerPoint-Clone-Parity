/**
 * Presentation-mode (slideshow) controller.
 *
 * Navigates the visible (non-hidden) slides of a presentation, advancing one
 * click group at a time within each slide, then slide-by-slide. Mirrors
 * PowerPoint semantics: stepping back onto a previous slide lands with all of
 * its click groups already played; reaching the end either finishes the show
 * or, in kiosk (loop) mode, wraps back to the first slide.
 */

import type { Animation, Id, Presentation, Slide } from '../core/types';
import { computeClickGroups } from '../animation/timeline';

export interface SlideshowOptions {
  /** Slide to start on (must be a visible slide). Defaults to the first. */
  startSlideId?: Id;
  /** Kiosk mode: wrap to the first slide instead of finishing. */
  loop?: boolean;
}

export interface CurrentSlideInfo {
  slide: Slide;
  /** 1-based position among visible slides. */
  slideNumber: number;
  totalVisible: number;
  /** Click groups on this slide that have not yet been played. */
  pendingClickGroups: number;
}

export interface AnimationVisibilityState {
  /** Element ids currently visible at this point of the slide's build. */
  visible: Id[];
  /** Element ids currently hidden (entrance not yet played, or exit played). */
  hidden: Id[];
}

export class SlideshowController {
  readonly presentation: Presentation;
  readonly loop: boolean;

  /** Index into the visible (non-hidden) slide list. */
  currentSlideIndex = 0;
  /** Number of click groups already played on the current slide. */
  currentClickIndex = 0;
  finished = false;

  private readonly startIndex: number;

  constructor(presentation: Presentation, options: SlideshowOptions = {}) {
    this.presentation = presentation;
    this.loop = options.loop ?? false;

    const visible = this.visibleSlides();
    if (visible.length === 0) {
      throw new Error('Cannot start a slideshow: the presentation has no visible slides');
    }
    if (options.startSlideId !== undefined) {
      const index = visible.findIndex((s) => s.id === options.startSlideId);
      if (index === -1) {
        throw new Error(`Start slide '${options.startSlideId}' is not a visible slide`);
      }
      this.startIndex = index;
    } else {
      this.startIndex = 0;
    }
    this.currentSlideIndex = this.startIndex;
  }

  /** Non-hidden slides in presentation order. */
  visibleSlides(): Slide[] {
    return this.presentation.slides.filter((s) => !s.hidden);
  }

  private currentSlide(): Slide {
    return this.visibleSlides()[this.currentSlideIndex];
  }

  private clickGroups(): Animation[][] {
    return computeClickGroups(this.currentSlide().animations);
  }

  /** (Re)start the show at the configured start slide. */
  start(): void {
    this.currentSlideIndex = this.startIndex;
    this.currentClickIndex = 0;
    this.finished = false;
  }

  current(): CurrentSlideInfo {
    const visible = this.visibleSlides();
    const slide = visible[this.currentSlideIndex];
    return {
      slide,
      slideNumber: this.currentSlideIndex + 1,
      totalVisible: visible.length,
      pendingClickGroups: Math.max(0, this.clickGroups().length - this.currentClickIndex),
    };
  }

  /**
   * Advance one step: play the next click group if any remain, otherwise move
   * to the next visible slide. At the very end: wrap when looping, else set
   * finished (after which next() is a no-op).
   */
  next(): void {
    if (this.finished) return;
    if (this.currentClickIndex < this.clickGroups().length) {
      this.currentClickIndex += 1;
      return;
    }
    const total = this.visibleSlides().length;
    if (this.currentSlideIndex < total - 1) {
      this.currentSlideIndex += 1;
      this.currentClickIndex = 0;
    } else if (this.loop) {
      this.currentSlideIndex = 0;
      this.currentClickIndex = 0;
    } else {
      this.finished = true;
    }
  }

  /**
   * Step back: un-play the last click group, or move to the previous slide
   * landing with all of its click groups already played (like PowerPoint).
   * From the finished state, returns to the last slide fully played.
   */
  prev(): void {
    if (this.finished) {
      this.finished = false;
      this.currentClickIndex = this.clickGroups().length;
      return;
    }
    if (this.currentClickIndex > 0) {
      this.currentClickIndex -= 1;
      return;
    }
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex -= 1;
      this.currentClickIndex = this.clickGroups().length;
    }
    // On the first slide with nothing played: no-op.
  }

  /**
   * Jump to a slide by id or by 1-based visible slide number. Resets the click
   * index and clears the finished flag. Throws for unknown/hidden targets.
   */
  goTo(target: Id | number): void {
    const visible = this.visibleSlides();
    let index: number;
    if (typeof target === 'number') {
      index = target - 1;
      if (!Number.isInteger(target) || index < 0 || index >= visible.length) {
        throw new Error(`Slide number ${target} is out of range (1..${visible.length})`);
      }
    } else {
      index = visible.findIndex((s) => s.id === target);
      if (index === -1) {
        throw new Error(`Slide '${target}' is not a visible slide`);
      }
    }
    this.currentSlideIndex = index;
    this.currentClickIndex = 0;
    this.finished = false;
  }

  firstSlide(): void {
    this.goTo(1);
  }

  lastSlide(): void {
    this.goTo(this.visibleSlides().length);
  }

  /** End the show immediately. */
  end(): void {
    this.finished = true;
  }

  /**
   * Which elements are visible/hidden on the current slide at the current
   * click index. Elements with an entrance animation start hidden until the
   * entrance's click group has played; elements without one are visible from
   * the start; a played exit hides the element (later played entrances can
   * re-show it, in play order).
   */
  visibleAnimationsState(): AnimationVisibilityState {
    const slide = this.currentSlide();
    const groups = computeClickGroups(slide.animations);
    const played = groups.slice(0, this.currentClickIndex).flat();

    const hasEntrance = new Set(
      slide.animations.filter((a) => a.category === 'entrance').map((a) => a.targetElementId),
    );

    // Deterministic order: slide elements first, then animation-only targets.
    const state = new Map<Id, boolean>();
    for (const el of slide.elements) state.set(el.id, !hasEntrance.has(el.id));
    for (const anim of slide.animations) {
      if (!state.has(anim.targetElementId)) {
        state.set(anim.targetElementId, !hasEntrance.has(anim.targetElementId));
      }
    }

    for (const anim of played) {
      if (anim.category === 'entrance') state.set(anim.targetElementId, true);
      else if (anim.category === 'exit') state.set(anim.targetElementId, false);
    }

    const visible: Id[] = [];
    const hidden: Id[] = [];
    for (const [id, isVisible] of state) (isVisible ? visible : hidden).push(id);
    return { visible, hidden };
  }

  /** Auto-advance delay (ms) for the current slide, or null for click-only. */
  autoAdvanceDelay(): number | null {
    return this.currentSlide().transition.advanceAfter ?? null;
  }

  /** Speaker notes for the current slide as plain text. */
  notesForCurrent(): string {
    return this.currentSlide()
      .notes.paragraphs.map((p) =>
        p.children.map((child) => (child.type === 'run' ? child.text : '\n')).join(''),
      )
      .join('\n');
  }
}
