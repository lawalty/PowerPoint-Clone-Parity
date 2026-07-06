/**
 * Small lookup helpers shared across the model operations.
 */

import type { Id, Presentation, Slide, SlideLayout, SlideMaster } from '../core/types';

/** Index of a slide in presentation order, or -1 when absent. */
export function getSlideIndex(pres: Presentation, slideId: Id): number {
  return pres.slides.findIndex((s) => s.id === slideId);
}

/** Look up a slide by id; throws a descriptive error when absent. */
export function getSlide(pres: Presentation, slideId: Id): Slide {
  const slide = pres.slides.find((s) => s.id === slideId);
  if (!slide) throw new Error(`Slide "${slideId}" not found in presentation "${pres.id}"`);
  return slide;
}

/** Look up a layout by id; throws a descriptive error when absent. */
export function getLayout(pres: Presentation, layoutId: Id): SlideLayout {
  const layout = pres.layouts.find((l) => l.id === layoutId);
  if (!layout) throw new Error(`Layout "${layoutId}" not found in presentation "${pres.id}"`);
  return layout;
}

/** Look up a master by id; throws a descriptive error when absent. */
export function getMaster(pres: Presentation, masterId: Id): SlideMaster {
  const master = pres.masters.find((m) => m.id === masterId);
  if (!master) throw new Error(`Master "${masterId}" not found in presentation "${pres.id}"`);
  return master;
}
