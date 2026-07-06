/**
 * Per-render context: the resolved theme/scheme for the slide being drawn
 * plus a collector for <defs> entries (gradients, patterns, clip paths,
 * markers) with unique ids.
 */

import type { ColorScheme, Presentation, Slide, Theme } from '../core/types';
import { getLayout, getMaster, getTheme } from '../style';
import { createOfficeTheme } from '../model/theme';

export interface RenderContext {
  theme: Theme;
  scheme: ColorScheme;
  /** Collected <defs> fragments, emitted once at the top of the svg. */
  defs: string[];
  /** Mint a unique def id with the given prefix. */
  nextId(prefix: string): string;
}

/** Sanitize an id prefix so generated def ids are always valid XML ids. */
function safeIdPrefix(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return cleaned.length > 0 ? `s${cleaned}` : 'svg';
}

/** Resolve the theme for a slide (slide -> layout -> master -> theme). */
export function themeForSlide(pres: Presentation, slide: Slide): Theme {
  const layout = getLayout(pres, slide);
  const master = layout
    ? getMaster(pres, layout)
    : pres.masters.find((m) => m.id === pres.defaultMasterId) ?? pres.masters[0];
  const theme = master ? getTheme(pres, master) : undefined;
  return theme ?? pres.themes[0] ?? createOfficeTheme();
}

export function createContext(pres: Presentation, slide: Slide): RenderContext {
  const theme = themeForSlide(pres, slide);
  const prefix = safeIdPrefix(slide.id);
  let counter = 0;
  return {
    theme,
    scheme: theme.colorScheme,
    defs: [],
    nextId(idKind: string): string {
      counter += 1;
      return `${prefix}-${idKind}-${counter}`;
    },
  };
}
