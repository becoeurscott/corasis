import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Gradient, Txt } from '@/components/ui';
import { formatDate } from '@/lib/time';
import type { CalendarEvent } from '@/services/backend';
import { radius, spacing } from '@/theme/tokens';

export function CountdownCard({ meeting }: { meeting: { event: CalendarEvent; days: number } | null }) {
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={meeting ? `Next meeting in ${meeting.days} days` : 'Plan your next meeting'} onPress={() => router.push(meeting ? `/meetings/${meeting.event.id}` : '/meetings/edit')}>
      <Gradient style={{ borderRadius: radius.lg, padding: spacing.lg }}>
        {meeting ? (
          <View style={{ gap: 2 }}>
            <Txt variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Next meeting
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Txt style={{ color: '#fff', fontSize: 52, lineHeight: 58, fontWeight: '800' }}>{meeting.days}</Txt>
              <Txt variant="heading" style={{ color: '#fff', marginBottom: 10 }}>
                {meeting.days === 0 ? 'today!' : meeting.days === 1 ? 'day to go' : 'days to go'}
              </Txt>
            </View>
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
