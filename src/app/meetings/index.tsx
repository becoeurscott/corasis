import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { CountdownCard } from '@/components/home/CountdownCard';
import { Banner, Button, Card, EmptyState, Header, Screen, SectionTitle, Txt } from '@/components/ui';
import { nextMeeting, pastMeetings, upcomingEvents } from '@/lib/events';
import { formatDate } from '@/lib/time';
import { useCouple, useEvents } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

const kindEmoji: Record<string, string> = { meeting: '✈️', anniversary: '💍', birthday: '🎂', visit: '🧳', custom: '📌' };

export default function MeetingsOverview() {
  const couple = useCouple();
  const events = useEvents();
  if (!couple) {
    return (
      <Screen>
        <Header title="Next meeting" />
        <EmptyState emoji="📅" title="Plan visits together" body="The shared calendar unlocks once you are connected." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
      </Screen>
    );
  }
  const next = nextMeeting(events, couple.coupleTimezone);
  const upcoming = upcomingEvents(events, couple.coupleTimezone).filter((x) => !(next && x.event.id === next.event.id));
  const past = pastMeetings(events, couple.coupleTimezone);
  const justPassed = past.find((e) => e.kind === 'meeting' && !events.some((x) => x.kind === 'meeting' && x.date > e.date));

  return (
    <Screen>
      <Header title="Next meeting" right={<Button title="＋ Event" size="sm" full={false} onPress={() => router.push('/meetings/edit')} />} />
      <View style={{ gap: spacing.lg }}>
        <CountdownCard meeting={next} />
        {next?.days === 0 ? <Banner kind="success" title="It's today" body="Enjoy it. We will stay quiet. When you are back, save a memory from the visit." actionTitle="Add a memory" onAction={() => router.push('/memories/new')} /> : null}
        {!next && justPassed ? <Banner kind="info" title={`How was ${justPassed.destination ?? 'the visit'}?`} body="Save a memory from it, or plan the next one so the countdown starts again." actionTitle="Plan the next visit" onAction={() => router.push('/meetings/edit?kind=meeting')} /> : null}
        {!next ? <Button title="Plan a meeting" onPress={() => router.push('/meetings/edit?kind=meeting')} /> : null}

        <SectionTitle title="Shared calendar" action="Reminders" onAction={() => router.push('/settings/notifications')} />
        {upcoming.length ? upcoming.map(({ event, date, days }) => (
          <Card key={event.id} onPress={() => router.push(`/meetings/${event.id}`)} accessibilityLabel={event.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Txt style={{ fontSize: 26 }}>{kindEmoji[event.kind]}</Txt>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{event.title}</Txt>
              <Txt variant="caption" tone="secondary">
                {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}{event.recurringAnnual ? ' · every year' : ''}{event.destination ? ` · ${event.destination}` : ''}
              </Txt>
            </View>
            <Txt variant="caption" tone="primary" weight="700">
              {days === 0 ? 'Today' : `in ${days} d`}
            </Txt>
          </Card>
        )) : (
          <Txt tone="muted">No upcoming dates. Add birthdays, anniversaries or trips.</Txt>
        )}

        <SectionTitle title="Past visits" />
        {past.length ? past.map((e) => (
          <Card key={e.id} onPress={() => router.push(`/meetings/${e.id}`)} tint style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Txt style={{ fontSize: 22 }}>{kindEmoji[e.kind]}</Txt>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{e.title}{e.destination ? ` · ${e.destination}` : ''}</Txt>
              <Txt variant="caption" tone="muted">
                {formatDate(e.date)}
              </Txt>
            </View>
          </Card>
        )) : (
          <Txt tone="muted">Past meetings will be listed here.</Txt>
        )}
      </View>
    </Screen>
  );
}
