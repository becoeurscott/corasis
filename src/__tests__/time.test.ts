import { addDays, dayKeyInZone, diffDays, zoneDifferenceHours } from '@/lib/time';
import { inQuietHours } from '@/lib/notifications';
import { daysUntil, nextMeeting, nextOccurrence } from '@/lib/events';
import type { CalendarEvent } from '@/services/backend/types';

describe('couple day boundaries', () => {
  it('uses the couple timezone, not UTC', () => {
    const instant = new Date('2026-03-01T03:30:00Z');
    expect(dayKeyInZone(instant, 'UTC')).toBe('2026-03-01');
    expect(dayKeyInZone(instant, 'America/Montreal')).toBe('2026-02-28');
    expect(dayKeyInZone(instant, 'Asia/Tokyo')).toBe('2026-03-01');
  });
  it('handles DST transitions through the zone', () => {
    // Paris switches to summer time on 2026-03-29.
    expect(dayKeyInZone(new Date('2026-03-28T23:30:00Z'), 'Europe/Paris')).toBe('2026-03-29');
    expect(dayKeyInZone(new Date('2026-03-29T22:30:00Z'), 'Europe/Paris')).toBe('2026-03-30');
  });
  it('adds and diffs days without DST drift', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(diffDays('2026-01-01', '2026-01-31')).toBe(30);
  });
  it('computes timezone differences', () => {
    expect(zoneDifferenceHours('Europe/Paris', 'America/Montreal', new Date('2026-01-15T12:00:00Z'))).toBe(-6);
  });
});

describe('quiet hours', () => {
  it('handles overnight windows', () => {
    expect(inQuietHours('23:00', '22:00', '08:00')).toBe(true);
    expect(inQuietHours('07:59', '22:00', '08:00')).toBe(true);
    expect(inQuietHours('12:00', '22:00', '08:00')).toBe(false);
  });
});

describe('meetings and recurrence', () => {
  const base: CalendarEvent = { id: 'e', coupleId: 'c', kind: 'meeting', title: 'Visit', date: '2999-05-10', allDay: true, time: null, timezone: 'UTC', destination: null, notes: null, recurringAnnual: false, reminders: [], cancelled: false, createdBy: 'a' };
  it('never returns a negative countdown', () => {
    expect(nextMeeting([base], 'UTC')).not.toBeNull();
    const past = { ...base, date: '2000-01-01' };
    expect(nextMeeting([past], 'UTC')).toBeNull();
  });
  it('rolls annual events to the next occurrence', () => {
    const anniv = { ...base, kind: 'anniversary' as const, date: '2020-02-14', recurringAnnual: true };
    expect(nextOccurrence(anniv, '2026-02-13')).toBe('2026-02-14');
    expect(nextOccurrence(anniv, '2026-02-15')).toBe('2027-02-14');
    expect(daysUntil(anniv, '2026-02-13')).toBe(1);
  });
  it('ignores cancelled meetings', () => {
    expect(nextMeeting([{ ...base, date: '2999-01-01', cancelled: true }], 'UTC')).toBeNull();
  });
});
