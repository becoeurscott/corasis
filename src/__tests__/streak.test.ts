import { computeStreak, daysCompleted } from '@/lib/streak';
import type { Moment } from '@/services/backend/types';

const m = (authorId: string, dayKey: string, id = `${authorId}-${dayKey}-${Math.random()}`): Moment => ({
  id,
  coupleId: 'c',
  authorId,
  dayKey,
  media: { id: 'x', kind: 'photo', uri: 'u', uploadState: 'uploaded', createdAt: '' },
  caption: null,
  createdAt: '',
  clientRequestId: id,
});

describe('streak rules', () => {
  const members = ['a', 'b'];

  it('counts a day only when both members contributed', () => {
    expect(daysCompleted([m('a', '2026-01-01')], members)).toEqual([]);
    expect(daysCompleted([m('a', '2026-01-01'), m('b', '2026-01-01')], members)).toEqual(['2026-01-01']);
  });

  it('never gives extra credit for additional moments', () => {
    const s = computeStreak([m('a', '2026-01-01'), m('a', '2026-01-01'), m('b', '2026-01-01'), m('b', '2026-01-01')], members, '2026-01-01');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
  });

  it('keeps the current streak alive when today is not done yet', () => {
    const s = computeStreak([m('a', '2026-01-01'), m('b', '2026-01-01'), m('a', '2026-01-02'), m('b', '2026-01-02')], members, '2026-01-03');
    expect(s.current).toBe(2);
    expect(s.startedOn).toBe('2026-01-01');
  });

  it('resets after a missed day but keeps the longest streak', () => {
    const moments = [m('a', '2026-01-01'), m('b', '2026-01-01'), m('a', '2026-01-02'), m('b', '2026-01-02'), m('a', '2026-01-05'), m('b', '2026-01-05')];
    const s = computeStreak(moments, members, '2026-01-05');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('is zero when the last completion is older than yesterday', () => {
    const s = computeStreak([m('a', '2026-01-01'), m('b', '2026-01-01')], members, '2026-01-10');
    expect(s.current).toBe(0);
    expect(s.longest).toBe(1);
  });
});
