/**
 * Shared lightweight element rendering: each slide element becomes an
 * absolutely-positioned <div data-element-id> styled from its transform and
 * resolved fill. Used by both the editor Canvas and the SlideshowView.
 */

import type { ColorScheme, Presentation, Slide, SlideElement } from '../core/types';
import { builtInThemes, gradientToCss, resolveFill } from '../style';
import { getBodyText } from '../text';

/** The slide's title text: title placeholder first, else first text found. */
export function slideTitleText(slide: Slide): string {
  let fallback = '';
  for (const el of slide.elements) {
    if (el.type !== 'shape' && el.type !== 'textbox') continue;
    const text = getBodyText(el.textBody).trim();
    if (!text) continue;
    if (el.placeholder?.kind === 'title' || el.placeholder?.kind === 'centeredTitle') {
      return text;
    }
    if (!fallback) fallback = text;
  }
  return fallback;
}

/** Non-title text blocks of a slide, for the outline view. */
export function slideBodyTexts(slide: Slide): string[] {
  const out: string[] = [];
  let skippedTitle = false;
  const hasTitlePlaceholder = slide.elements.some(
    (el) =>
      (el.type === 'shape' || el.type === 'textbox') &&
      (el.placeholder?.kind === 'title' || el.placeholder?.kind === 'centeredTitle'),
  );
  for (const el of slide.elements) {
    if (el.type !== 'shape' && el.type !== 'textbox') continue;
    const text = getBodyText(el.textBody).trim();
    if (!text) continue;
    const isTitle = hasTitlePlaceholder
      ? el.placeholder?.kind === 'title' || el.placeholder?.kind === 'centeredTitle'
      : !skippedTitle;
    if (isTitle) {
      skippedTitle = true;
      continue;
    }
    out.push(text);
  }
  return out;
}

/** Color scheme in effect for a slide (slide -> layout -> master -> theme). */
export function schemeForSlide(pres: Presentation, slide: Slide): ColorScheme {
  const layout = pres.layouts.find((l) => l.id === slide.layoutId);
  const master = layout ? pres.masters.find((m) => m.id === layout.masterId) : undefined;
  const theme =
    (master ? pres.themes.find((t) => t.id === master.themeId) : undefined) ?? pres.themes[0];
  return theme?.colorScheme ?? builtInThemes()[0].colorScheme;
}

/** Apply position/size/rotation styles from the element's transform. */
export function applyTransformStyles(div: HTMLElement, element: SlideElement, zoom: number): void {
  const t = element.transform;
  div.style.position = 'absolute';
  div.style.left = `${t.x * zoom}px`;
  div.style.top = `${t.y * zoom}px`;
  div.style.width = `${t.width * zoom}px`;
  div.style.height = `${t.height * zoom}px`;
  div.style.transform = t.rotation !== 0 ? `rotate(${t.rotation}deg)` : '';
}

/** Build the <div> for one element (recursing into group children). */
export function renderElementDiv(
  element: SlideElement,
  scheme: ColorScheme,
  zoom: number,
): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `element element-${element.type}`;
  div.dataset.elementId = element.id;
  applyTransformStyles(div, element, zoom);
  if (element.hidden) div.style.display = 'none';

  if (
    element.type === 'shape' ||
    element.type === 'textbox' ||
    element.type === 'freeform'
  ) {
    const fill = resolveFill(element.fill, scheme);
    if (fill.type === 'solid') {
      div.style.backgroundColor = fill.css;
    } else if (fill.type === 'gradient') {
      div.style.backgroundImage = gradientToCss(fill);
    }
  }
  if (element.type === 'shape' && element.geometry === 'ellipse') {
    div.style.borderRadius = '50%';
  }
  if (element.type === 'shape' || element.type === 'textbox') {
    div.textContent = getBodyText(element.textBody);
  }
  if (element.type === 'picture') {
    div.title = element.altText || element.src;
    div.dataset.src = element.src;
  }
  if (element.type === 'group') {
    for (const child of element.children) {
      div.appendChild(renderElementDiv(child, scheme, zoom));
    }
  }
  return div;
}
