import { meetingCountdown } from '@/lib/events';
test('countdown', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  expect(meetingCountdown({ date: '2027-01-09', time: '13:30', allDay: false }, 'UTC', now)).toEqual({ months: 2, days: 2, hours: 1, minutes: 30, seconds: 0 });
  expect(meetingCountdown({ date: '2026-11-07', time: null, allDay: true }, 'UTC', now)).toBeNull();
  expect(meetingCountdown({ date: '2026-11-08', time: null, allDay: true }, 'Europe/Paris', now)).toEqual({ months: 0, days: 0, hours: 11, minutes: 0, seconds: 0 });
});
