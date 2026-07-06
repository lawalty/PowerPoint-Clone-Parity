/**
 * Built-in theme catalog and theme application.
 */

import type { ColorScheme, Presentation, Theme, ThemeColorSlot } from '../core/types';
import { deepClone } from '../core/util';

const SLOT_ORDER: ThemeColorSlot[] = [
  'dark1',
  'light1',
  'dark2',
  'light2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hyperlink',
  'followedHyperlink',
];

function scheme(name: string, hexes: string[]): ColorScheme {
  const colors = {} as Record<ThemeColorSlot, string>;
  SLOT_ORDER.forEach((slot, i) => {
    colors[slot] = hexes[i];
  });
  return { name, colors };
}

function theme(id: string, name: string, hexes: string[], major: string, minor: string): Theme {
  return {
    id,
    name,
    colorScheme: scheme(name, hexes),
    fontScheme: { name, major, minor },
  };
}

/**
 * Built-in themes mirroring PowerPoint's catalog. Each has a complete
 * 12-slot color scheme and a font scheme. A fresh copy is returned on
 * every call so callers may mutate freely.
 */
export function builtInThemes(): Theme[] {
  return [
    theme(
      'theme-office',
      'Office',
      // dark1, light1, dark2, light2, accent1..6, hyperlink, followedHyperlink
      ['000000', 'FFFFFF', '44546A', 'E7E6E6', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'],
      'Calibri Light',
      'Calibri',
    ),
    theme(
      'theme-facet',
      'Facet',
      ['000000', 'FFFFFF', '2C3C43', 'EBEBEB', '90C226', '54A021', 'E6B91E', 'E76618', 'C42F1A', '918655', '99CA3C', 'B9D181'],
      'Trebuchet MS',
      'Trebuchet MS',
    ),
    theme(
      'theme-ion',
      'Ion',
      ['000000', 'FFFFFF', '1E5155', 'EBEBEB', 'B01513', 'EA6312', 'E6B729', '6AAC90', '5F9C9D', '9E5E9B', '8C8C8C', 'A92E2C'],
      'Century Gothic',
      'Century Gothic',
    ),
    theme(
      'theme-retrospect',
      'Retrospect',
      ['000000', 'FFFFFF', '637052', 'CCDDEA', 'B31166', 'E33D6F', 'E45F3C', 'E9943A', '9B6BF2', 'D53DD0', '8E58B6', '7F6F6F'],
      'Calibri Light',
      'Calibri',
    ),
  ];
}

/** Look up a built-in theme by name (case-insensitive). */
export function builtInTheme(name: string): Theme | undefined {
  return builtInThemes().find((t) => t.name.toLowerCase() === name.toLowerCase());
}

/**
 * Apply a theme to a presentation: replaces the theme referenced by the
 * default master's themeId with (a deep clone of) the given theme, keeping
 * the existing theme object's id so masters referencing it stay valid.
 * Mutates and returns the presentation.
 */
export function applyTheme(presentation: Presentation, theme: Theme): Presentation {
  const master =
    presentation.masters.find((m) => m.id === presentation.defaultMasterId) ??
    presentation.masters[0];
  const targetId = master?.themeId ?? presentation.themes[0]?.id ?? theme.id;
  const replacement: Theme = { ...deepClone(theme), id: targetId };
  const index = presentation.themes.findIndex((t) => t.id === targetId);
  if (index >= 0) {
    presentation.themes[index] = replacement;
  } else {
    presentation.themes.push(replacement);
  }
  return presentation;
}
