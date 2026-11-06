import type { Moment, StreakState } from '@/services/backend/types';
import { addDays } from './time';

/**
 * Pure streak computation. A day is "complete" when every member has at least
 * one moment for that dayKey. Extra moments never add extra credit.
 */
export function daysCompleted(moments: Moment[], memberIds: string[]): string[] {
  const byDay = new Map<string, Set<string>>();
  for (const m of moments) {
    if (!byDay.has(m.dayKey)) byDay.set(m.dayKey, new Set());
    byDay.get(m.dayKey)!.add(m.authorId);
  }
  return [...byDay.entries()]
    .filter(([, authors]) => memberIds.length > 0 && memberIds.every((id) => authors.has(id)))
    .map(([day]) => day)
    .sort();
}

export function computeStreak(moments: Moment[], memberIds: string[], today: string): StreakState {
  const days = daysCompleted(moments, memberIds);
  const set = new Set(days);
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  // Current streak: count back from today (or yesterday if today isn't done yet).
  let anchor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(anchor)) {
    current += 1;
    anchor = addDays(anchor, -1);
  }
  const startedOn = current > 0 ? addDays(anchor, 1) : null;
  return {
    current,
    longest,
    startedOn,
    lastCompletedDay: days.length ? days[days.length - 1] : null,
    completions: days.map((dayKey) => ({ dayKey, completedAt: dayKey })),
  };
}
