/**
 * Slideshow (presentation-mode) controller and presenter timing.
 */

export { SlideshowController } from './controller';
export type {
  SlideshowOptions,
  CurrentSlideInfo,
  AnimationVisibilityState,
} from './controller';

export { estimateSlideshowDuration } from './timing';
