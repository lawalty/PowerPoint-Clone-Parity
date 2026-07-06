/**
 * Presenter timing helpers.
 */

import type { Presentation } from '../core/types';
import { computeClickGroups } from '../animation/timeline';

/**
 * Estimate the total running time of the slideshow in milliseconds.
 *
 * For each visible slide: uses transition.advanceAfter when set, otherwise
 * budgets `msPerClickDefault` for each click of the slide — its click groups
 * plus the final click that advances to the next slide.
 */
export function estimateSlideshowDuration(
  pres: Presentation,
  msPerClickDefault = 3000,
): number {
  let total = 0;
  for (const slide of pres.slides) {
    if (slide.hidden) continue;
    if (slide.transition.advanceAfter !== undefined) {
      total += slide.transition.advanceAfter;
    } else {
      const clicks = computeClickGroups(slide.animations).length + 1;
      total += msPerClickDefault * clicks;
    }
  }
  return total;
}
