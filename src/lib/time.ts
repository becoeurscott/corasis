/** Timezone + couple-day helpers. All "days" are computed in the couple timezone. */

export function dayKeyInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return dayKeyInZone(now, timeZone);
}

export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function formatLocalTime(now: Date, timeZone: string, hour12 = false): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, hour: '2-digit', minute: '2-digit', hour12 }).format(now);
  } catch {
    return '--:--';
  }
}

/** Offset in minutes of a timezone from UTC at a given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Hours difference between two zones (positive when b is ahead of a). */
export function zoneDifferenceHours(a: string, b: string, at: Date = new Date()): number {
  return (zoneOffsetMinutes(b, at) - zoneOffsetMinutes(a, at)) / 60;
}

export function describeDifference(hours: number): string {
  if (hours === 0) return 'Same time zone';
  const abs = Math.abs(hours);
  const label = abs === 1 ? '1 hour' : `${abs % 1 === 0 ? abs : abs.toFixed(1)} hours`;
  return hours > 0 ? `${label} ahead` : `${label} behind`;
}

export function formatDate(dayKey: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function isStale(iso: string | null, maxMinutes: number, now: Date = new Date()): boolean {
  if (!iso) return true;
  return now.getTime() - new Date(iso).getTime() > maxMinutes * 60_000;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const commonTimezones = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Montreal',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Africa/Lagos',
  'Africa/Douala',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/** Minutes until midnight in a zone (used for "time left today" messaging). */
export function minutesUntilDayEnd(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return 24 * 60 - (h * 60 + m);
}
