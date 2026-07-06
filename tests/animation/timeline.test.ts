import { describe, expect, it } from 'vitest';

import {
  animationProgress,
  computeClickGroups,
  computeTimeline,
  groupDuration,
  interpolateAlongPath,
} from '../../src/animation';
import type { Animation } from '../../src/core/types';

let counter = 0;
function anim(overrides: Partial<Animation> = {}): Animation {
  counter += 1;
  return {
    id: `a${counter}`,
    targetElementId: 'el-1',
    category: 'entrance',
    effect: 'fade',
    trigger: 'onClick',
    delay: 0,
    duration: 500,
    repeat: 1,
    ...overrides,
  };
}

describe('computeClickGroups', () => {
  it('returns no groups for an empty animation list', () => {
    expect(computeClickGroups([])).toEqual([]);
  });

  it('starts a new group at each onClick animation', () => {
    const a = anim({ trigger: 'onClick' });
    const b = anim({ trigger: 'withPrevious' });
    const c = anim({ trigger: 'afterPrevious' });
    const d = anim({ trigger: 'onClick' });
    const e = anim({ trigger: 'afterPrevious' });
    const groups = computeClickGroups([a, b, c, d, e]);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((x) => x.id)).toEqual([a.id, b.id, c.id]);
    expect(groups[1].map((x) => x.id)).toEqual([d.id, e.id]);
  });

  it('the very first animation starts a group even when not onClick', () => {
    const a = anim({ trigger: 'withPrevious' });
    const b = anim({ trigger: 'afterPrevious' });
    const c = anim({ trigger: 'onClick' });
    const groups = computeClickGroups([a, b, c]);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((x) => x.id)).toEqual([a.id, b.id]);
    expect(groups[1].map((x) => x.id)).toEqual([c.id]);
  });

  it('all-onClick animations each form their own group', () => {
    const groups = computeClickGroups([anim(), anim(), anim()]);
    expect(groups.map((g) => g.length)).toEqual([1, 1, 1]);
  });
});

describe('computeTimeline', () => {
  it('onClick starts at its own delay within its click group', () => {
    const a = anim({ delay: 0, duration: 400 });
    const b = anim({ delay: 150, duration: 600 });
    const timeline = computeTimeline([a, b]);
    expect(timeline).toEqual([
      { animationId: a.id, startMs: 0, endMs: 400, clickIndex: 0 },
      { animationId: b.id, startMs: 150, endMs: 750, clickIndex: 1 },
    ]);
  });

  it('withPrevious starts at the previous animation start plus its delay', () => {
    const a = anim({ delay: 100, duration: 1000 });
    const b = anim({ trigger: 'withPrevious', delay: 50, duration: 300 });
    const timeline = computeTimeline([a, b]);
    expect(timeline[0]).toMatchObject({ startMs: 100, endMs: 1100, clickIndex: 0 });
    expect(timeline[1]).toMatchObject({ startMs: 150, endMs: 450, clickIndex: 0 });
  });

  it('afterPrevious chains: each starts at the previous end plus its delay', () => {
    const a = anim({ duration: 500 });
    const b = anim({ trigger: 'afterPrevious', delay: 200, duration: 300 });
    const c = anim({ trigger: 'afterPrevious', delay: 0, duration: 100 });
    const timeline = computeTimeline([a, b, c]);
    expect(timeline[0]).toMatchObject({ startMs: 0, endMs: 500 });
    expect(timeline[1]).toMatchObject({ startMs: 700, endMs: 1000 });
    expect(timeline[2]).toMatchObject({ startMs: 1000, endMs: 1100 });
    expect(timeline.every((e) => e.clickIndex === 0)).toBe(true);
  });

  it('accounts for repeat in the effective duration', () => {
    const a = anim({ duration: 200, repeat: 3 });
    const b = anim({ trigger: 'afterPrevious', duration: 100, repeat: 2 });
    const timeline = computeTimeline([a, b]);
    expect(timeline[0]).toMatchObject({ startMs: 0, endMs: 600 });
    expect(timeline[1]).toMatchObject({ startMs: 600, endMs: 800 });
  });

  it('mixed triggers: withPrevious after an afterPrevious chain', () => {
    const a = anim({ duration: 400 }); // group 0: 0..400
    const b = anim({ trigger: 'afterPrevious', delay: 100, duration: 200 }); // 500..700
    const c = anim({ trigger: 'withPrevious', delay: 25, duration: 1000 }); // 525..1525
    const d = anim({ delay: 10, duration: 50 }); // group 1: 10..60
    const timeline = computeTimeline([a, b, c, d]);
    expect(timeline[1]).toMatchObject({ startMs: 500, endMs: 700, clickIndex: 0 });
    expect(timeline[2]).toMatchObject({ startMs: 525, endMs: 1525, clickIndex: 0 });
    expect(timeline[3]).toMatchObject({ startMs: 10, endMs: 60, clickIndex: 1 });
  });

  it('a leading withPrevious animation starts its group at its delay', () => {
    const a = anim({ trigger: 'withPrevious', delay: 75, duration: 100 });
    const timeline = computeTimeline([a]);
    expect(timeline[0]).toMatchObject({ startMs: 75, endMs: 175, clickIndex: 0 });
  });
});

describe('groupDuration', () => {
  it('is 0 for an empty group', () => {
    expect(groupDuration([])).toBe(0);
  });

  it('is the latest end time in the group', () => {
    const a = anim({ duration: 400 });
    const b = anim({ trigger: 'withPrevious', delay: 0, duration: 1000 });
    const c = anim({ trigger: 'afterPrevious', delay: 0, duration: 100 });
    // a: 0..400, b: 0..1000, c: 1000..1100 (after b)
    expect(groupDuration([a, b, c])).toBe(1100);
    expect(groupDuration([a])).toBe(400);
    expect(groupDuration([anim({ delay: 300, duration: 200, repeat: 2 })])).toBe(700);
  });
});

describe('animationProgress', () => {
  it('clamps to 0 before the delay elapses and to 1 after completion', () => {
    const a = anim({ delay: 200, duration: 1000 });
    expect(animationProgress(a, -50)).toBe(0);
    expect(animationProgress(a, 0)).toBe(0);
    expect(animationProgress(a, 200)).toBe(0);
    expect(animationProgress(a, 700)).toBeCloseTo(0.5);
    expect(animationProgress(a, 1200)).toBe(1);
    expect(animationProgress(a, 99999)).toBe(1);
  });

  it('spreads progress across all repeats', () => {
    const a = anim({ delay: 0, duration: 400, repeat: 2 });
    expect(animationProgress(a, 400)).toBeCloseTo(0.5);
    expect(animationProgress(a, 800)).toBe(1);
  });

  it('zero-duration animations snap from 0 to 1 at their delay', () => {
    const a = anim({ delay: 100, duration: 0 });
    expect(animationProgress(a, 99)).toBe(0);
    expect(animationProgress(a, 100)).toBe(1);
    expect(animationProgress(a, 500)).toBe(1);
  });
});

describe('interpolateAlongPath', () => {
  const L = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it('interpolates by arc length across segments', () => {
    expect(interpolateAlongPath(L, 0)).toEqual({ x: 0, y: 0 });
    expect(interpolateAlongPath(L, 0.25)).toEqual({ x: 5, y: 0 });
    expect(interpolateAlongPath(L, 0.5)).toEqual({ x: 10, y: 0 }); // corner
    expect(interpolateAlongPath(L, 0.75)).toEqual({ x: 10, y: 5 });
    expect(interpolateAlongPath(L, 1)).toEqual({ x: 10, y: 10 });
  });

  it('weights unequal segments by their length', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 30, y: 0 }, // length 30
      { x: 30, y: 10 }, // length 10
    ];
    expect(interpolateAlongPath(path, 0.5)).toEqual({ x: 20, y: 0 });
    expect(interpolateAlongPath(path, 0.75)).toEqual({ x: 30, y: 0 });
    expect(interpolateAlongPath(path, 0.875)).toEqual({ x: 30, y: 5 });
  });

  it('clamps t outside 0..1', () => {
    expect(interpolateAlongPath(L, -1)).toEqual({ x: 0, y: 0 });
    expect(interpolateAlongPath(L, 2)).toEqual({ x: 10, y: 10 });
  });

  it('handles degenerate paths', () => {
    expect(interpolateAlongPath([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
    // all points coincident -> zero total length
    expect(
      interpolateAlongPath(
        [
          { x: 2, y: 2 },
          { x: 2, y: 2 },
        ],
        0.7,
      ),
    ).toEqual({ x: 2, y: 2 });
    expect(() => interpolateAlongPath([], 0.5)).toThrow();
  });

  it('returns a fresh point, not a reference into the path', () => {
    const p = interpolateAlongPath(L, 0);
    expect(p).not.toBe(L[0]);
  });
});
