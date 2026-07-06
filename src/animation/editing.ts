/**
 * Animation editing operations: add / remove / reorder animations on a slide,
 * plus the category -> effects catalog used to validate effect membership.
 */

import type {
  Animation,
  AnimationCategory,
  AnimationEffect,
  AnimationTrigger,
  Id,
  Point,
  Slide,
} from '../core/types';
import { clamp, genId } from '../core/util';

const CATALOG: Record<AnimationCategory, readonly AnimationEffect[]> = {
  entrance: ['appear', 'fade', 'flyIn', 'floatIn', 'wipe', 'split', 'zoom', 'grow', 'bounce', 'swivel'],
  emphasis: ['pulse', 'spin', 'teeter', 'colorPulse', 'growShrink', 'transparency'],
  exit: ['appear', 'fade', 'flyOut', 'floatOut', 'wipe', 'split', 'zoom', 'grow', 'bounce', 'swivel'],
  motionPath: ['pathLine', 'pathArc', 'pathCircle', 'pathCustom'],
};

/** Map of animation category -> effects valid for that category. */
export function animationCatalog(): Record<AnimationCategory, AnimationEffect[]> {
  return {
    entrance: [...CATALOG.entrance],
    emphasis: [...CATALOG.emphasis],
    exit: [...CATALOG.exit],
    motionPath: [...CATALOG.motionPath],
  };
}

/** True when the effect is valid for the category. */
export function effectBelongsToCategory(
  category: AnimationCategory,
  effect: AnimationEffect,
): boolean {
  return CATALOG[category]?.includes(effect) ?? false;
}

export interface AddAnimationOptions {
  trigger?: AnimationTrigger;
  /** Delay after trigger in ms (default 0). */
  delay?: number;
  /** Duration in ms (default 500). */
  duration?: number;
  direction?: Animation['direction'];
  /** Waypoints for motion-path effects. */
  path?: Point[];
  /** Repeat count, 1 = play once (default 1). */
  repeat?: number;
}

/** Default path assigned to motion-path animations when none is provided. */
const DEFAULT_MOTION_PATH: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0 },
];

/**
 * Create an animation and append it to the slide's animation list (order is
 * play order). Throws when the effect does not belong to the category, or on
 * invalid numeric options.
 */
export function addAnimation(
  slide: Slide,
  targetElementId: Id,
  category: AnimationCategory,
  effect: AnimationEffect,
  opts: AddAnimationOptions = {},
): Animation {
  if (!(category in CATALOG)) {
    throw new Error(`Unknown animation category: ${String(category)}`);
  }
  if (!effectBelongsToCategory(category, effect)) {
    throw new Error(`Effect '${effect}' does not belong to category '${category}'`);
  }

  const delay = opts.delay ?? 0;
  const duration = opts.duration ?? 500;
  const repeat = opts.repeat ?? 1;
  if (!Number.isFinite(delay) || delay < 0) {
    throw new Error(`Animation delay must be >= 0, got ${delay}`);
  }
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error(`Animation duration must be >= 0, got ${duration}`);
  }
  if (!Number.isFinite(repeat) || repeat < 1) {
    throw new Error(`Animation repeat must be >= 1, got ${repeat}`);
  }

  const anim: Animation = {
    id: genId('anim'),
    targetElementId,
    category,
    effect,
    trigger: opts.trigger ?? 'onClick',
    delay,
    duration,
    repeat,
  };
  if (opts.direction !== undefined) anim.direction = opts.direction;
  if (opts.path !== undefined) {
    anim.path = opts.path.map((p) => ({ x: p.x, y: p.y }));
  } else if (category === 'motionPath') {
    anim.path = DEFAULT_MOTION_PATH.map((p) => ({ ...p }));
  }

  slide.animations.push(anim);
  return anim;
}

/** Remove an animation by id. Returns true when one was removed. */
export function removeAnimation(slide: Slide, animId: Id): boolean {
  const index = slide.animations.findIndex((a) => a.id === animId);
  if (index === -1) return false;
  slide.animations.splice(index, 1);
  return true;
}

/**
 * Move an animation to a new position in the play order. The index is clamped
 * to the valid range. Throws when the animation does not exist on the slide.
 */
export function reorderAnimation(slide: Slide, animId: Id, newIndex: number): void {
  const index = slide.animations.findIndex((a) => a.id === animId);
  if (index === -1) {
    throw new Error(`Animation '${animId}' not found on slide '${slide.id}'`);
  }
  const target = clamp(Math.trunc(newIndex), 0, slide.animations.length - 1);
  if (target === index) return;
  const [anim] = slide.animations.splice(index, 1);
  slide.animations.splice(target, 0, anim);
}

/** All animations targeting the given element, in play order. */
export function animationsForElement(slide: Slide, elementId: Id): Animation[] {
  return slide.animations.filter((a) => a.targetElementId === elementId);
}

/**
 * Remove every animation targeting the given element (call when the element is
 * deleted). Returns the number of animations removed.
 */
export function removeAnimationsForElement(slide: Slide, elementId: Id): number {
  const before = slide.animations.length;
  slide.animations = slide.animations.filter((a) => a.targetElementId !== elementId);
  return before - slide.animations.length;
}
