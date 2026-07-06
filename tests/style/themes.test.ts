import { describe, expect, it } from 'vitest';
import { applyTheme, builtInTheme, builtInThemes, getTheme } from '../../src/style';
import type { ThemeColorSlot } from '../../src/core/types';
import { makePresentation } from './fixtures';

const ALL_SLOTS: ThemeColorSlot[] = [
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

describe('builtInThemes', () => {
  it('includes at least the four core themes', () => {
    const names = builtInThemes().map((t) => t.name);
    expect(names.length).toBeGreaterThanOrEqual(4);
    for (const name of ['Office', 'Facet', 'Ion', 'Retrospect']) {
      expect(names).toContain(name);
    }
  });

  it('every theme has all 12 color slots with valid 6-digit hex values', () => {
    for (const theme of builtInThemes()) {
      expect(Object.keys(theme.colorScheme.colors).sort()).toEqual([...ALL_SLOTS].sort());
      for (const slot of ALL_SLOTS) {
        expect(theme.colorScheme.colors[slot]).toMatch(/^[0-9A-F]{6}$/i);
      }
    }
  });

  it('every theme has a complete font scheme and unique id', () => {
    const themes = builtInThemes();
    const ids = new Set(themes.map((t) => t.id));
    expect(ids.size).toBe(themes.length);
    for (const theme of themes) {
      expect(theme.fontScheme.major.length).toBeGreaterThan(0);
      expect(theme.fontScheme.minor.length).toBeGreaterThan(0);
    }
  });

  it('color schemes are pairwise distinct', () => {
    const themes = builtInThemes();
    const accent1s = new Set(themes.map((t) => t.colorScheme.colors.accent1));
    expect(accent1s.size).toBe(themes.length);
    const serialized = new Set(themes.map((t) => JSON.stringify(t.colorScheme.colors)));
    expect(serialized.size).toBe(themes.length);
  });

  it('returns fresh copies each call', () => {
    const a = builtInThemes()[0];
    const b = builtInThemes()[0];
    expect(a).not.toBe(b);
    a.colorScheme.colors.accent1 = '123456';
    expect(builtInThemes()[0].colorScheme.colors.accent1).not.toBe('123456');
  });

  it('builtInTheme looks up by name case-insensitively', () => {
    expect(builtInTheme('ion')?.name).toBe('Ion');
    expect(builtInTheme('Nope')).toBeUndefined();
  });
});

describe('applyTheme', () => {
  it('replaces the default master theme content while preserving its id', () => {
    const pres = makePresentation();
    const facet = builtInTheme('Facet')!;
    applyTheme(pres, facet);

    expect(pres.themes).toHaveLength(1);
    expect(pres.themes[0].id).toBe('th1'); // original id preserved
    expect(pres.themes[0].name).toBe('Facet');
    expect(pres.themes[0].colorScheme.colors.accent1).toBe('90C226');
    expect(pres.themes[0].fontScheme.major).toBe('Trebuchet MS');
  });

  it('keeps master references valid after applying', () => {
    const pres = makePresentation();
    applyTheme(pres, builtInTheme('Ion')!);
    const master = pres.masters[0];
    const resolved = getTheme(pres, master);
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe('Ion');
  });

  it('does not mutate the source theme and does not share references', () => {
    const pres = makePresentation();
    const office = builtInTheme('Office')!;
    applyTheme(pres, office);
    expect(office.id).toBe('theme-office'); // source untouched
    pres.themes[0].colorScheme.colors.accent1 = 'ABCDEF';
    expect(office.colorScheme.colors.accent1).toBe('4472C4');
  });

  it('can be applied repeatedly, always targeting the same theme id', () => {
    const pres = makePresentation();
    applyTheme(pres, builtInTheme('Facet')!);
    applyTheme(pres, builtInTheme('Retrospect')!);
    expect(pres.themes).toHaveLength(1);
    expect(pres.themes[0].id).toBe('th1');
    expect(pres.themes[0].name).toBe('Retrospect');
  });
});
