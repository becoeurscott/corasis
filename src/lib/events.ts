import type { CalendarEvent } from '@/services/backend';
import { addDays, diffDays, todayKey, zoneOffsetMinutes } from './time';

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

/** Time left until a meeting starts (its time, or midnight if all-day) in the given zone. Null once it has started. */
export function meetingCountdown(event: Pick<CalendarEvent, 'date' | 'time' | 'allDay'>, timeZone: string, now: Date = new Date()):
  { months: number; days: number; hours: number; minutes: number; seconds: number } | null {
  const [y, m, d] = event.date.split('-').map(Number);
  const [hh, mm] = !event.allDay && event.time ? event.time.split(':').map(Number) : [0, 0];
  // Work in the zone's wall clock (UTC fields used as plain calendar values).
  const nowWall = new Date(now.getTime() + zoneOffsetMinutes(timeZone, now) * 60_000);
  const target = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0));
  if (target.getTime() <= nowWall.getTime()) return null;
  const addMonths = (dt: Date, n: number) => { const r = new Date(dt); r.setUTCMonth(r.getUTCMonth() + n); return r; };
  let months = (target.getUTCFullYear() - nowWall.getUTCFullYear()) * 12 + (target.getUTCMonth() - nowWall.getUTCMonth());
  while (months > 0 && addMonths(nowWall, months).getTime() > target.getTime()) months--;
  let rest = Math.floor((target.getTime() - addMonths(nowWall, months).getTime()) / 1000);
  const days = Math.floor(rest / 86400); rest -= days * 86400;
  const hours = Math.floor(rest / 3600); rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  return { months, days, hours, minutes, seconds: rest - minutes * 60 };
}
