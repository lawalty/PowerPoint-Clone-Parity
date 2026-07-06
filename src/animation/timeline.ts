/**
 * Click-group partitioning and timeline computation for slide animations.
 *
 * A slide's animations play in list order. Each 'onClick' animation begins a
 * new click group (and the very first animation always begins one, regardless
 * of its trigger). 'withPrevious' / 'afterPrevious' animations join the
 * current group. Timeline times are milliseconds relative to the start of the
 * animation's click group.
 */

import type { Animation, Id } from '../core/types';

export interface TimelineEntry {
  animationId: Id;
  /** Start time in ms relative to the click group's start. */
  startMs: number;
  /** End time in ms relative to the click group's start. */
  endMs: number;
  /** Index of the click group this animation belongs to. */
  clickIndex: number;
}

/** Partition a slide's animations into click groups. */
export function computeClickGroups(animations: Animation[]): Animation[][] {
  const groups: Animation[][] = [];
  for (const anim of animations) {
    if (groups.length === 0 || anim.trigger === 'onClick') {
      groups.push([anim]);
    } else {
      groups[groups.length - 1].push(anim);
    }
  }
  return groups;
}

/** Total play time of one run through the animation, accounting for repeat. */
function effectiveDuration(anim: Animation): number {
  return anim.duration * Math.max(1, anim.repeat);
}

function timelineForGroup(group: Animation[], clickIndex: number): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let prevStart = 0;
  let prevEnd = 0;
  for (let i = 0; i < group.length; i++) {
    const anim = group[i];
    let startMs: number;
    if (i === 0) {
      // The group leader (onClick, or the very first animation) starts at the
      // group's time zero plus its own delay.
      startMs = anim.delay;
    } else if (anim.trigger === 'withPrevious') {
      startMs = prevStart + anim.delay;
    } else {
      // 'afterPrevious'
      startMs = prevEnd + anim.delay;
    }
    const endMs = startMs + effectiveDuration(anim);
    entries.push({ animationId: anim.id, startMs, endMs, clickIndex });
    prevStart = startMs;
    prevEnd = endMs;
  }
  return entries;
}

/**
 * Compute start/end times for every animation. Times are relative to each
 * animation's own click group; clickIndex says which group it belongs to.
 */
export function computeTimeline(animations: Animation[]): TimelineEntry[] {
  return computeClickGroups(animations).flatMap((group, i) => timelineForGroup(group, i));
}

/** Total duration of one click group (latest end time; 0 for an empty group). */
export function groupDuration(group: Animation[]): number {
  return timelineForGroup(group, 0).reduce((max, e) => Math.max(max, e.endMs), 0);
}
