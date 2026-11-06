import type { CalendarEvent } from '@/services/backend';
import { addDays, diffDays, todayKey } from './time';

/** Next occurrence date of an event (handles annual recurrence). */
export function nextOccurrence(ev: CalendarEvent, today: string): string {
  if (!ev.recurringAnnual) return ev.date;
  const [, m, d] = ev.date.split('-');
  const [ty] = today.split('-');
  const thisYear = `${ty}-${m}-${d}`;
  return thisYear >= today ? thisYear : `${Number(ty) + 1}-${m}-${d}`;
}

export function daysUntil(ev: CalendarEvent, today: string): number {
  return diffDays(today, nextOccurrence(ev, today));
}

/** The next non-cancelled meeting on/after today, or null. Never negative. */
export function nextMeeting(events: CalendarEvent[], timeZone: string): { event: CalendarEvent; days: number } | null {
  const today = todayKey(timeZone);
  const upcoming = events
    .filter((e) => e.kind === 'meeting' && !e.cancelled && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  return { event: upcoming[0], days: Math.max(0, diffDays(today, upcoming[0].date)) };
}

export function pastMeetings(events: CalendarEvent[], timeZone: string): CalendarEvent[] {
  const today = todayKey(timeZone);
  return events.filter((e) => (e.kind === 'meeting' || e.kind === 'visit') && e.date < today).sort((a, b) => b.date.localeCompare(a.date));
}

export function upcomingEvents(events: CalendarEvent[], timeZone: string, horizonDays = 400): { event: CalendarEvent; date: string; days: number }[] {
  const today = todayKey(timeZone);
  const limit = addDays(today, horizonDays);
  return events
    .filter((e) => !e.cancelled)
    .map((e) => ({ event: e, date: nextOccurrence(e, today) }))
    .filter((x) => x.date >= today && x.date <= limit)
    .map((x) => ({ ...x, days: diffDays(today, x.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
