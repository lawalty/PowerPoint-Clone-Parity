import { beforeEach, describe, expect, it } from 'vitest';

import {
  addAnimation,
  animationCatalog,
  animationsForElement,
  effectBelongsToCategory,
  removeAnimation,
  removeAnimationsForElement,
  reorderAnimation,
} from '../../src/animation';
import type {
  AnimationCategory,
  AnimationEffect,
  Slide,
} from '../../src/core/types';
import { defaultTextBody, defaultTransition } from '../../src/core/defaults';
import { resetIds } from '../../src/core/util';

// Compiler-checked exhaustive lists of the union members.
const CATEGORY_RECORD: Record<AnimationCategory, true> = {
  entrance: true,
  emphasis: true,
  exit: true,
  motionPath: true,
};
const ALL_CATEGORIES = Object.keys(CATEGORY_RECORD) as AnimationCategory[];

const EFFECT_RECORD: Record<AnimationEffect, true> = {
  appear: true,
  fade: true,
  flyIn: true,
  flyOut: true,
  floatIn: true,
  floatOut: true,
  wipe: true,
  split: true,
  zoom: true,
  grow: true,
  bounce: true,
  swivel: true,
  pulse: true,
  spin: true,
  teeter: true,
  colorPulse: true,
  growShrink: true,
  transparency: true,
  pathLine: true,
  pathArc: true,
  pathCircle: true,
  pathCustom: true,
};
const ALL_EFFECTS = Object.keys(EFFECT_RECORD) as AnimationEffect[];

function makeSlide(id = 's1'): Slide {
  return {
    id,
    layoutId: 'layout-1',
    elements: [],
    transition: defaultTransition(),
    animations: [],
    notes: defaultTextBody(),
    comments: [],
    hidden: false,
    hideBackgroundGraphics: false,
  };
}

beforeEach(() => resetIds());

describe('animationCatalog', () => {
  it('has an entry for every AnimationCategory', () => {
    const catalog = animationCatalog();
    expect(Object.keys(catalog).sort()).toEqual([...ALL_CATEGORIES].sort());
  });

  it('every AnimationEffect belongs to at least one category', () => {
    const catalog = animationCatalog();
    const covered = new Set(Object.values(catalog).flat());
    for (const effect of ALL_EFFECTS) {
      expect(covered.has(effect), `effect '${effect}' missing from catalog`).toBe(true);
    }
  });

  it('classifies the canonical examples correctly', () => {
    const catalog = animationCatalog();
    expect(catalog.entrance).toContain('flyIn');
    expect(catalog.entrance).not.toContain('flyOut');
    expect(catalog.exit).toContain('flyOut');
    expect(catalog.exit).not.toContain('flyIn');
    expect(catalog.emphasis).toContain('pulse');
    expect(catalog.motionPath).toContain('pathLine');
    expect(catalog.motionPath).toEqual(['pathLine', 'pathArc', 'pathCircle', 'pathCustom']);
    expect(effectBelongsToCategory('entrance', 'flyIn')).toBe(true);
    expect(effectBelongsToCategory('emphasis', 'flyIn')).toBe(false);
    expect(effectBelongsToCategory('exit', 'fade')).toBe(true);
  });

  it('motion-path effects appear only in motionPath, emphasis only in emphasis', () => {
    const catalog = animationCatalog();
    for (const effect of catalog.motionPath) {
      expect(catalog.entrance).not.toContain(effect);
      expect(catalog.exit).not.toContain(effect);
      expect(catalog.emphasis).not.toContain(effect);
    }
    for (const effect of catalog.emphasis) {
      expect(catalog.entrance).not.toContain(effect);
      expect(catalog.exit).not.toContain(effect);
    }
  });

  it('returns a fresh copy each call', () => {
    const one = animationCatalog();
    one.entrance.length = 0;
    expect(animationCatalog().entrance.length).toBeGreaterThan(0);
  });
});

describe('addAnimation', () => {
  it('appends animations in order with sensible defaults and unique ids', () => {
    const slide = makeSlide();
    const a = addAnimation(slide, 'el-1', 'entrance', 'flyIn', { direction: 'left' });
    const b = addAnimation(slide, 'el-2', 'emphasis', 'pulse');
    expect(slide.animations).toEqual([a, b]);
    expect(a.id).not.toBe(b.id);
    expect(a.trigger).toBe('onClick');
    expect(a.delay).toBe(0);
    expect(a.duration).toBe(500);
    expect(a.repeat).toBe(1);
    expect(a.direction).toBe('left');
    expect(b.direction).toBeUndefined();
    expect(b.category).toBe('emphasis');
  });

  it('honors options', () => {
    const slide = makeSlide();
    const a = addAnimation(slide, 'el-1', 'exit', 'flyOut', {
      trigger: 'afterPrevious',
      delay: 250,
      duration: 900,
      repeat: 3,
    });
    expect(a.trigger).toBe('afterPrevious');
    expect(a.delay).toBe(250);
    expect(a.duration).toBe(900);
    expect(a.repeat).toBe(3);
  });

  it('gives motion-path animations a path (default or provided, copied)', () => {
    const slide = makeSlide();
    const auto = addAnimation(slide, 'el-1', 'motionPath', 'pathLine');
    expect(auto.path).toBeDefined();
    expect(auto.path!.length).toBeGreaterThanOrEqual(2);

    const waypoints = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
    ];
    const custom = addAnimation(slide, 'el-1', 'motionPath', 'pathCustom', { path: waypoints });
    expect(custom.path).toEqual(waypoints);
    expect(custom.path).not.toBe(waypoints);
    waypoints[0].x = 99;
    expect(custom.path![0].x).toBe(0);
  });

  it('throws when the effect does not belong to the category', () => {
    const slide = makeSlide();
    expect(() => addAnimation(slide, 'el-1', 'emphasis', 'flyIn')).toThrow(/category/);
    expect(() => addAnimation(slide, 'el-1', 'entrance', 'pulse')).toThrow(/category/);
    expect(() => addAnimation(slide, 'el-1', 'entrance', 'flyOut')).toThrow(/category/);
    expect(() => addAnimation(slide, 'el-1', 'exit', 'floatIn')).toThrow(/category/);
    expect(() => addAnimation(slide, 'el-1', 'motionPath', 'fade')).toThrow(/category/);
    expect(() => addAnimation(slide, 'el-1', 'emphasis', 'pathLine')).toThrow(/category/);
    expect(slide.animations).toHaveLength(0);
  });

  it('throws on invalid numeric options', () => {
    const slide = makeSlide();
    expect(() => addAnimation(slide, 'el-1', 'entrance', 'fade', { delay: -5 })).toThrow(/delay/);
    expect(() => addAnimation(slide, 'el-1', 'entrance', 'fade', { duration: -1 })).toThrow(
      /duration/,
    );
    expect(() => addAnimation(slide, 'el-1', 'entrance', 'fade', { repeat: 0 })).toThrow(/repeat/);
  });
});

describe('removeAnimation / reorderAnimation', () => {
  it('removes by id and reports whether anything was removed', () => {
    const slide = makeSlide();
    const a = addAnimation(slide, 'el-1', 'entrance', 'fade');
    const b = addAnimation(slide, 'el-2', 'exit', 'fade');
    expect(removeAnimation(slide, a.id)).toBe(true);
    expect(slide.animations).toEqual([b]);
    expect(removeAnimation(slide, 'nope')).toBe(false);
    expect(slide.animations).toEqual([b]);
  });

  it('reorders animations and clamps the target index', () => {
    const slide = makeSlide();
    const a = addAnimation(slide, 'el-1', 'entrance', 'fade');
    const b = addAnimation(slide, 'el-2', 'entrance', 'fade');
    const c = addAnimation(slide, 'el-3', 'entrance', 'fade');

    reorderAnimation(slide, c.id, 0);
    expect(slide.animations.map((x) => x.id)).toEqual([c.id, a.id, b.id]);

    reorderAnimation(slide, c.id, 999); // clamped to last
    expect(slide.animations.map((x) => x.id)).toEqual([a.id, b.id, c.id]);

    reorderAnimation(slide, b.id, -4); // clamped to first
    expect(slide.animations.map((x) => x.id)).toEqual([b.id, a.id, c.id]);

    reorderAnimation(slide, a.id, 1); // no-op move to own position
    expect(slide.animations.map((x) => x.id)).toEqual([b.id, a.id, c.id]);
  });

  it('throws when reordering an unknown animation', () => {
    const slide = makeSlide();
    addAnimation(slide, 'el-1', 'entrance', 'fade');
    expect(() => reorderAnimation(slide, 'missing', 0)).toThrow(/not found/);
  });
});

describe('animationsForElement / removeAnimationsForElement', () => {
  it('filters animations by target element in play order', () => {
    const slide = makeSlide();
    const a = addAnimation(slide, 'el-1', 'entrance', 'fade');
    addAnimation(slide, 'el-2', 'emphasis', 'spin');
    const c = addAnimation(slide, 'el-1', 'exit', 'flyOut');
    expect(animationsForElement(slide, 'el-1')).toEqual([a, c]);
    expect(animationsForElement(slide, 'el-3')).toEqual([]);
  });

  it('removes all animations for a deleted element and returns the count', () => {
    const slide = makeSlide();
    addAnimation(slide, 'el-1', 'entrance', 'fade');
    const keep = addAnimation(slide, 'el-2', 'emphasis', 'spin');
    addAnimation(slide, 'el-1', 'exit', 'flyOut');
    expect(removeAnimationsForElement(slide, 'el-1')).toBe(2);
    expect(slide.animations).toEqual([keep]);
    expect(removeAnimationsForElement(slide, 'el-1')).toBe(0);
  });
});
