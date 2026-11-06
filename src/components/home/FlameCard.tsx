import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Txt } from '@/components/ui';
import { minutesUntilDayEnd, todayKey } from '@/lib/time';
import type { Couple, Moment, Profile, StreakState } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

interface Props {
  couple: Couple;
  me: Profile;
  partner: Profile | null;
  moments: Moment[];
  streak: StreakState;
}

export function FlameCard({ couple, me, partner, moments, streak }: Props) {
  const { colors } = useTheme();
  const today = todayKey(couple.coupleTimezone);
  const mine = moments.some((m) => m.dayKey === today && m.authorId === me.id);
  const theirs = !!partner && moments.some((m) => m.dayKey === today && m.authorId === partner.id);
  const done = mine && theirs;
  const mins = minutesUntilDayEnd(couple.coupleTimezone);
  const hoursLeft = Math.floor(mins / 60);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.top}>
        <View style={[styles.flame, { backgroundColor: done ? colors.primary : colors.primarySoft }]}>
          <Txt style={{ fontSize: 26 }}>🔥</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{streak.current} {streak.current === 1 ? 'day' : 'days'}</Txt>
          <Txt variant="caption" tone="secondary">
            {done ? 'Today is complete. Nice.' : streak.current > 0 ? `Keep it going: ${hoursLeft} h left today` : 'Send a moment to start your flame'}
          </Txt>
        </View>
      </View>
      <View style={styles.statuses}>
        <Status name={me.firstName} done={mine} />
        <Status name={partner ? partner.firstName : 'Partner'} done={theirs} missing={!partner} />
      </View>
      {!mine ? <Button title="Send my moment" onPress={() => router.push('/flame/capture')} /> : !theirs ? <Txt variant="caption" tone="muted">Waiting for {partner?.firstName ?? 'your partner'} · extra moments are welcome but count once per day.</Txt> : null}
      <Button title="Flame details & history" variant="ghost" size="sm" onPress={() => router.push('/flame')} />
    </Card>
  );
}

function Status({ name, done, missing }: { name: string; done: boolean; missing?: boolean }) {
  const { colors } = useTheme();
  const label = missing ? 'Not connected' : done ? 'Sent ✓' : 'Waiting…';
  return (
    <View style={[styles.status, { backgroundColor: done ? colors.successSoft : colors.surfaceTint }]}>
      <Txt variant="caption" weight="700" style={{ color: done ? colors.success : colors.textSecondary }}>
        {name}: {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flame: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statuses: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  status: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
});
