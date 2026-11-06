import { router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Gradient, Header, Screen, SectionTitle, Txt } from '@/components/ui';
import { nextMeeting } from '@/lib/events';
import { relativeTime, todayKey } from '@/lib/time';
import { useData } from '@/services/backend';
import { useCouple, useEvents, useMe, useMoments, usePartner, useStreak, useWidgetMessage } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Widget setup + previews. Native extensions are scaffolded in /widgets (see docs/NATIVE.md). */
export default function WidgetsScreen() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const streak = useStreak();
  const events = useEvents();
  const moments = useMoments();
  const msg = useWidgetMessage();
  const profiles = useData((s) => s.profiles);
  const meeting = couple ? nextMeeting(events, couple.coupleTimezone) : null;
  const today = couple ? todayKey(couple.coupleTimezone) : '';
  const mine = !!me && moments.some((m) => m.dayKey === today && m.authorId === me.id);
  const theirs = !!partner && moments.some((m) => m.dayKey === today && m.authorId === partner.id);

  return (
    <Screen>
      <Header title="Widgets" />
      <View style={{ gap: spacing.lg }}>
        <Banner kind="info" title="Preview" body={Platform.OS === 'web' ? 'Home-screen widgets need the iOS/Android build. These previews show exactly what the widgets display; the data is shared through the same widget store.' : 'The widgets below ship as native extensions in a development build (WidgetKit / Glance). iOS refreshes widgets on its own schedule, usually within 15–30 minutes, so updates are not instant.'} />

        <SectionTitle title="Partner's message" action="Write" onAction={() => router.push('/widgets/message')} />
        <Gradient style={styles.widget}>
          <Txt variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {msg ? `${profiles[msg.authorId]?.firstName ?? 'Partner'} says` : 'Together'}
          </Txt>
          <Txt variant="title" style={{ color: '#fff' }}>
            {msg?.text ?? 'No message yet'}
          </Txt>
          {msg ? (
            <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {relativeTime(msg.updatedAt)}
            </Txt>
          ) : null}
        </Gradient>

        <SectionTitle title="Countdown" />
        <Card style={[styles.widget, { backgroundColor: colors.surface }]}>
          <Txt variant="label" tone="primary">
            Next meeting
          </Txt>
          <Txt variant="display">{meeting ? (meeting.days === 0 ? 'Today' : `${meeting.days} d`) : '—'}</Txt>
          <Txt variant="caption" tone="secondary">
            {meeting ? meeting.event.destination ?? meeting.event.title : 'Add a meeting to count down'}
          </Txt>
        </Card>

        <SectionTitle title="Daily flame" />
        <Card tint style={styles.widget}>
          <Txt variant="label" tone="primary">
            Flame
          </Txt>
          <Txt variant="display">🔥 {streak?.current ?? 0}</Txt>
          <Txt variant="caption" tone="secondary">
            {!couple ? 'Not connected' : mine && theirs ? 'Today complete' : mine ? `Waiting for ${partner?.firstName}` : 'Send your moment'}
          </Txt>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">How to add a widget</Txt>
          <Txt tone="secondary">iOS: long-press the Home or Lock Screen → “+” → Together. Android: long-press the Home screen → Widgets → Together. Available in the development build, not in Expo Go or the browser.</Txt>
          <Button title="Wallpaper editor" variant="secondary" onPress={() => router.push('/widgets/wallpaper')} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ widget: { borderRadius: radius.lg, padding: spacing.lg, gap: 4, minHeight: 130, justifyContent: 'center' } });
