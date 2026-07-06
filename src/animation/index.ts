/**
 * Transitions & animations engine.
 */

export {
  transitionCatalog,
  transitionMeta,
  validateTransition,
  setTransition,
  applyTransitionToAll,
} from './transitions';
export type { TransitionMeta, TransitionDirection } from './transitions';

export {
  animationCatalog,
  effectBelongsToCategory,
  addAnimation,
  removeAnimation,
  reorderAnimation,
  animationsForElement,
  removeAnimationsForElement,
} from './editing';
export type { AddAnimationOptions } from './editing';

export { computeClickGroups, computeTimeline, groupDuration } from './timeline';
export type { TimelineEntry } from './timeline';

export { animationProgress, interpolateAlongPath } from './progress';
