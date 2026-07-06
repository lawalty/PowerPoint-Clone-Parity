/**
 * Slide -> layout -> master -> theme inheritance resolution.
 */

import type {
  Fill,
  Presentation,
  Slide,
  SlideElement,
  SlideLayout,
  SlideMaster,
  TextBody,
  Theme,
  Transform,
} from '../core/types';

/** Find the layout a slide is based on. */
export function getLayout(pres: Presentation, slide: Slide): SlideLayout | undefined {
  return pres.layouts.find((l) => l.id === slide.layoutId);
}

/** Find the master a layout belongs to. */
export function getMaster(pres: Presentation, layout: SlideLayout): SlideMaster | undefined {
  return pres.masters.find((m) => m.id === layout.masterId);
}

/** Find the theme a master references. */
export function getTheme(pres: Presentation, master: SlideMaster): Theme | undefined {
  return pres.themes.find((t) => t.id === master.themeId);
}

/**
 * Resolve the effective background of a slide by walking the inheritance
 * chain: slide.background ?? layout.background ?? master.background.
 */
export function resolveSlideBackground(pres: Presentation, slide: Slide): Fill {
  if (slide.background) {
    return slide.background;
  }
  const layout = getLayout(pres, slide);
  if (layout?.background) {
    return layout.background;
  }
  const master = layout ? getMaster(pres, layout) : undefined;
  return master?.background ?? { type: 'none' };
}

function findPlaceholder(
  elements: SlideElement[],
  kind: string,
  index: number,
): SlideElement | undefined {
  return (
    elements.find((el) => el.placeholder?.index === index && el.placeholder.kind === kind) ??
    elements.find((el) => el.placeholder?.index === index) ??
    elements.find((el) => el.placeholder?.kind === kind)
  );
}

function textBodyOf(el: SlideElement | undefined): TextBody | undefined {
  if (!el) {
    return undefined;
  }
  if (el.type === 'shape' || el.type === 'textbox') {
    return el.textBody;
  }
  return undefined;
}

export interface PlaceholderDefaults {
  transform?: Transform;
  textBody?: TextBody;
}

/**
 * Resolve the effective defaults for a placeholder element on a slide by
 * finding the matching placeholder (same kind + index, then same index,
 * then same kind) on the layout, then the master. Per property, the slide
 * element's own value wins, then the layout's, then the master's.
 */
export function resolvePlaceholderDefaults(
  pres: Presentation,
  slide: Slide,
  placeholderElement: SlideElement,
): PlaceholderDefaults {
  const ph = placeholderElement.placeholder;
  if (!ph) {
    return {
      transform: placeholderElement.transform,
      textBody: textBodyOf(placeholderElement),
    };
  }
  const layout = getLayout(pres, slide);
  const master = layout ? getMaster(pres, layout) : undefined;
  const layoutPh = layout ? findPlaceholder(layout.elements, ph.kind, ph.index) : undefined;
  const masterPh = master ? findPlaceholder(master.elements, ph.kind, ph.index) : undefined;

  const transform =
    placeholderElement.transform ?? layoutPh?.transform ?? masterPh?.transform;
  const textBody =
    textBodyOf(placeholderElement) ?? textBodyOf(layoutPh) ?? textBodyOf(masterPh);

  const defaults: PlaceholderDefaults = {};
  if (transform) {
    defaults.transform = transform;
  }
  if (textBody) {
    defaults.textBody = textBody;
  }
  return defaults;
}

function decorations(elements: SlideElement[]): SlideElement[] {
  return elements.filter((el) => !el.placeholder && !el.hidden);
}

/**
 * The elements a renderer should draw for a slide, bottom-to-top:
 * master decorations (non-placeholder elements), then layout decorations,
 * then the slide's own elements. When slide.hideBackgroundGraphics is set,
 * master and layout decorations are dropped.
 */
export function effectiveElements(pres: Presentation, slide: Slide): SlideElement[] {
  if (slide.hideBackgroundGraphics) {
    return [...slide.elements];
  }
  const layout = getLayout(pres, slide);
  const master = layout ? getMaster(pres, layout) : undefined;
  return [
    ...(master ? decorations(master.elements) : []),
    ...(layout ? decorations(layout.elements) : []),
    ...slide.elements,
  ];
}
