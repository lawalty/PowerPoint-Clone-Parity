import { describe, expect, it } from 'vitest';
import type { LayoutKind, PlaceholderKind, ThemeColorSlot } from '../../src/core/types';
import { createPresentation, BUILT_IN_LAYOUT_KINDS } from '../../src/model';

const ALL_SLOTS: ThemeColorSlot[] = [
  'dark1', 'light1', 'dark2', 'light2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'hyperlink', 'followedHyperlink',
];

describe('createPresentation', () => {
  it('builds a presentation with sensible top-level defaults', () => {
    const now = () => 123456;
    const pres = createPresentation({ title: 'My Deck', author: 'Ada', now });
    expect(pres.formatVersion).toBe(1);
    expect(pres.slideSize).toEqual({ width: 960, height: 540 });
    expect(pres.properties.title).toBe('My Deck');
    expect(pres.properties.author).toBe('Ada');
    expect(pres.properties.createdAt).toBe(123456);
    expect(pres.properties.modifiedAt).toBe(123456);
    expect(pres.properties.revision).toBe(1);
    expect(pres.sections).toEqual([]);
  });

  it('has an Office-like theme with all 12 color slots and Calibri fonts', () => {
    const pres = createPresentation();
    expect(pres.themes).toHaveLength(1);
    const theme = pres.themes[0];
    for (const slot of ALL_SLOTS) {
      expect(theme.colorScheme.colors[slot]).toMatch(/^[0-9A-Fa-f]{6}$/);
    }
    expect(theme.fontScheme.major).toBe('Calibri Light');
    expect(theme.fontScheme.minor).toBe('Calibri');
  });

  it('has one master with background and the standard placeholders', () => {
    const pres = createPresentation();
    expect(pres.masters).toHaveLength(1);
    const master = pres.masters[0];
    expect(master.themeId).toBe(pres.themes[0].id);
    expect(pres.defaultMasterId).toBe(master.id);
    expect(master.background).toBeDefined();
    const kinds = master.elements.map((e) => e.placeholder?.kind);
    expect(kinds).toContain('title');
    expect(kinds).toContain('body');
    expect(kinds).toContain('slideNumber');
    expect(kinds).toContain('date');
    expect(kinds).toContain('footer');
    expect(master.layoutIds).toHaveLength(9);
  });

  it('has all 9 built-in layouts wired to the master', () => {
    const pres = createPresentation();
    expect(pres.layouts).toHaveLength(9);
    const kinds = pres.layouts.map((l) => l.kind);
    for (const kind of BUILT_IN_LAYOUT_KINDS) expect(kinds).toContain(kind);
    for (const layout of pres.layouts) {
      expect(layout.masterId).toBe(pres.masters[0].id);
      expect(pres.masters[0].layoutIds).toContain(layout.id);
    }
  });

  it('kinds each layout placeholder correctly with in-bounds positions', () => {
    const pres = createPresentation();
    const byKind = new Map(pres.layouts.map((l) => [l.kind, l]));

    const expectKinds = (kind: LayoutKind, expected: PlaceholderKind[]) => {
      const layout = byKind.get(kind)!;
      expect(layout.elements.map((e) => e.placeholder?.kind)).toEqual(expected);
    };

    expectKinds('title', ['centeredTitle', 'subtitle']);
    expectKinds('titleAndContent', ['title', 'content']);
    expectKinds('sectionHeader', ['title', 'body']);
    expectKinds('twoContent', ['title', 'content', 'content']);
    expectKinds('comparison', ['title', 'body', 'content', 'body', 'content']);
    expectKinds('titleOnly', ['title']);
    expectKinds('blank', []);
    expectKinds('contentWithCaption', ['title', 'body', 'content']);
    expectKinds('pictureWithCaption', ['title', 'body', 'picture']);

    // every placeholder fits within the 960x540 slide and has a unique index
    for (const layout of pres.layouts) {
      const indices = new Set<number>();
      for (const el of layout.elements) {
        const t = el.transform;
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.x + t.width).toBeLessThanOrEqual(960);
        expect(t.y + t.height).toBeLessThanOrEqual(540);
        expect(indices.has(el.placeholder!.index)).toBe(false);
        indices.add(el.placeholder!.index);
      }
    }
  });

  it('starts with exactly one slide using the title layout', () => {
    const pres = createPresentation();
    expect(pres.slides).toHaveLength(1);
    const slide = pres.slides[0];
    const layout = pres.layouts.find((l) => l.id === slide.layoutId)!;
    expect(layout.kind).toBe('title');
    expect(slide.elements.map((e) => e.placeholder?.kind)).toEqual(['centeredTitle', 'subtitle']);
    expect(slide.hidden).toBe(false);
    expect(slide.comments).toEqual([]);
  });

  it('generates unique ids for every entity and element', () => {
    const pres = createPresentation();
    const ids: string[] = [
      pres.id,
      ...pres.themes.map((t) => t.id),
      ...pres.masters.map((m) => m.id),
      ...pres.layouts.map((l) => l.id),
      ...pres.slides.map((s) => s.id),
      ...pres.masters.flatMap((m) => m.elements.map((e) => e.id)),
      ...pres.layouts.flatMap((l) => l.elements.map((e) => e.id)),
      ...pres.slides.flatMap((s) => s.elements.map((e) => e.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
