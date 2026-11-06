import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MediaThumb } from '@/components/MediaThumb';
import { Banner, Button, Card, EmptyState, Header, Screen, SectionTitle, Txt } from '@/components/ui';
import { formatDate, todayKey } from '@/lib/time';
import { useCouple, useMe, useMoments, usePartner, useStreak } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function FlameOverview() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const moments = useMoments();
  const streak = useStreak();
  if (!me) return null;

  if (!couple || !streak) {
    return (
      <Screen>
        <Header title="Daily flame" />
        <EmptyState emoji="🔥" title="The flame needs two" body="Connect with your partner to start sending daily moments." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
      </Screen>
    );
  }
  const today = todayKey(couple.coupleTimezone);
  const todays = moments.filter((m) => m.dayKey === today);
  const mine = todays.filter((m) => m.authorId === me.id);
  const theirs = todays.filter((m) => partner && m.authorId === partner.id);
  const lostStreak = streak.current === 0 && streak.longest > 0;

  return (
    <Screen>
      <Header title="Daily flame" right={<Button title="History" variant="ghost" size="sm" full={false} onPress={() => router.push('/flame/history')} />} />
      <View style={{ gap: spacing.lg }}>
        <Card tint style={{ alignItems: 'center', gap: 4 }}>
          <Txt style={{ fontSize: 48, lineHeight: 56 }}>🔥</Txt>
          <Txt variant="display">{streak.current}</Txt>
          <Txt tone="secondary">{streak.current === 1 ? 'day in a row' : 'days in a row'}</Txt>
          <View style={styles.stats}>
            <Stat label="Longest" value={`${streak.longest}`} />
            <Stat label="Started" value={streak.startedOn ? formatDate(streak.startedOn, { month: 'short', day: 'numeric' }) : '—'} />
            <Stat label="Day boundary" value={couple.coupleTimezone.split('/').pop()?.replace(/_/g, ' ') ?? ''} />
          </View>
        </Card>
        {lostStreak ? <Banner kind="info" title="A new chapter" body={`Your last streak reached ${streak.longest} days. Streaks are a game, not a grade. Today is a fine day to start again.`} /> : null}
        <Banner kind="info" body={`A day counts once you both send at least one moment before midnight in ${couple.coupleTimezone.replace(/_/g, ' ')}. Extra moments are welcome and do not add extra credit.`} actionTitle="Change day boundary" onAction={() => router.push('/settings/timezone')} />

        <SectionTitle title="Today" />
        <View style={styles.pair}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Txt variant="bodyStrong">{me.firstName}</Txt>
            {mine.length ? <MediaThumb media={mine[mine.length - 1].media} label={mine[mine.length - 1].caption ?? 'Your moment'} /> : (
              <Card tint style={[styles.placeholder, { borderColor: colors.border }]} padded={false}>
                <Txt variant="caption" tone="muted" center>
                  Not sent yet
                </Txt>
              </Card>
            )}
            {mine.length ? <Txt variant="caption" tone="success">Sent ✓{mine.length > 1 ? ` (+${mine.length - 1} more)` : ''}</Txt> : <Txt variant="caption" tone="muted">Waiting on you</Txt>}
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Txt variant="bodyStrong">{partner?.firstName ?? 'Partner'}</Txt>
            {theirs.length ? <MediaThumb media={theirs[theirs.length - 1].media} label={theirs[theirs.length - 1].caption ?? `${partner?.firstName}'s moment`} /> : (
              <Card tint style={[styles.placeholder, { borderColor: colors.border }]} padded={false}>
                <Txt variant="caption" tone="muted" center>
                  Not sent yet
                </Txt>
              </Card>
            )}
            {theirs.length ? <Txt variant="caption" tone="success">Sent ✓</Txt> : <Txt variant="caption" tone="muted">Waiting…</Txt>}
          </View>
        </View>
        <Button title={mine.length ? 'Send another moment' : 'Send my moment'} size="lg" onPress={() => router.push('/flame/capture')} />
        <Button title="See today's details" variant="ghost" onPress={() => router.push(`/flame/${today}`)} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Txt variant="bodyStrong">{value}</Txt>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', marginTop: spacing.md, width: '100%' },
  pair: { flexDirection: 'row', gap: spacing.md },
  placeholder: { aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed' },
});
