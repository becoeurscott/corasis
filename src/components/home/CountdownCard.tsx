import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Gradient, Txt } from '@/components/ui';
import { meetingCountdown } from '@/lib/events';
import { formatDate } from '@/lib/time';
import type { CalendarEvent } from '@/services/backend';
import { radius, spacing } from '@/theme/tokens';

/** Months · days · hours · minutes · seconds, ticking every second. */
function LiveCountdown({ event, timeZone }: { event: CalendarEvent; timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const left = meetingCountdown(event, timeZone, now);
  if (!left) return <Txt style={{ color: '#fff', fontSize: 40, fontWeight: '800' }}>Today! 💞</Txt>;
  const tiles: [number, string][] = [
    [left.months, left.months === 1 ? 'month' : 'months'],
    [left.days, left.days === 1 ? 'day' : 'days'], [left.hours, 'hrs'], [left.minutes, 'min'], [left.seconds, 'sec'],
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }} accessible accessibilityLabel={`${left.months} months, ${left.days} days, ${left.hours} hours, ${left.minutes} minutes to go`}>
      {tiles.map(([v, label]) => (
        <View key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <Txt style={{ color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{String(v).padStart(2, '0')}</Txt>
          <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>{label}</Txt>
        </View>
      ))}
    </View>
  );
}

export function CountdownCard({ meeting, timeZone }: { meeting: { event: CalendarEvent; days: number } | null; timeZone: string }) {
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={meeting ? `Next meeting in ${meeting.days} days` : 'Plan your next meeting'} onPress={() => router.push(meeting ? `/meetings/${meeting.event.id}` : '/meetings/edit')}>
      <Gradient style={{ borderRadius: radius.lg, padding: spacing.lg }}>
        {meeting ? (
          <View style={{ gap: 2 }}>
            <Txt variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Next meeting
            </Txt>
            <LiveCountdown event={meeting.event} timeZone={timeZone} />
            <Txt style={{ color: 'rgba(255,255,255,0.92)' }}>
              {meeting.event.destination ? `${meeting.event.destination} · ` : ''}
              {formatDate(meeting.event.date, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Txt>
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            <Txt variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Next meeting
            </Txt>
            <Txt variant="heading" style={{ color: '#fff' }}>
              Nothing planned yet
            </Txt>
            <Txt style={{ color: 'rgba(255,255,255,0.9)' }}>Add a date and we will count down together.</Txt>
          </View>
        )}
      </Gradient>
    </MotionPressable>
  );
}
