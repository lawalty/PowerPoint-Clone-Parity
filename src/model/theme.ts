/**
 * Default "Office"-like theme construction.
 */

import type { ColorScheme, FontScheme, Theme } from '../core/types';
import { genId } from '../core/util';

/** The classic Office color scheme (hex without '#'), all 12 slots. */
export function createOfficeColorScheme(): ColorScheme {
  return {
    name: 'Office',
    colors: {
      dark1: '000000',
      light1: 'FFFFFF',
      dark2: '44546A',
      light2: 'E7E6E6',
      accent1: '4472C4',
      accent2: 'ED7D31',
      accent3: 'A5A5A5',
      accent4: 'FFC000',
      accent5: '5B9BD5',
      accent6: '70AD47',
      hyperlink: '0563C1',
      followedHyperlink: '954F72',
    },
  };
}

export function createOfficeFontScheme(): FontScheme {
  return {
    name: 'Office',
    major: 'Calibri Light',
    minor: 'Calibri',
  };
}

/** Build the default Office theme with a fresh id. */
export function createOfficeTheme(): Theme {
  return {
    id: genId('theme'),
    name: 'Office Theme',
    colorScheme: createOfficeColorScheme(),
    fontScheme: createOfficeFontScheme(),
  };
}
