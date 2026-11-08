import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, EmptyState, Header, Screen, Txt } from '@/components/ui';
import { daysCompleted } from '@/lib/streak';
import { addDays, formatDate, todayKey } from '@/lib/time';
import { useCouple, useMoments } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Month calendar of completed days + list view. */
export default function FlameHistory() {
  const { colors } = useTheme();
  const couple = useCouple();
  const moments = useMoments();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const today = todayKey(couple?.coupleTimezone ?? 'UTC');
  const [cursor, setCursor] = useState(today.slice(0, 7)); // YYYY-MM

  const completed = useMemo(() => new Set(couple ? daysCompleted(moments, couple.memberIds) : []), [moments, couple]);
  const partial = useMemo(() => new Set(moments.map((m) => m.dayKey)), [moments]);

  const [y, m] = cursor.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${cursor}-${String(i + 1).padStart(2, '0')}`)];
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setCursor(d.toISOString().slice(0, 7));
  };
  const days = [...partial].sort().reverse();

  return (
    <Screen>
      <Header title="Flame history" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Chip label="Calendar" selected={view === 'calendar'} onPress={() => setView('calendar')} />
        <Chip label="List" selected={view === 'list'} onPress={() => setView('list')} />
      </View>
      {view === 'calendar' ? (
        <Card style={{ gap: spacing.md }}>
          <View style={styles.monthRow}>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shift(-1)} hitSlop={10} style={styles.nav}>
              <Txt variant="heading">‹</Txt>
            </MotionPressable>
            <Txt variant="heading">{monthLabel}</Txt>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shift(1)} hitSlop={10} style={styles.nav}>
              <Txt variant="heading">›</Txt>
            </MotionPressable>
          </View>
          <View style={styles.grid}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Txt key={i} variant="caption" tone="muted" center style={styles.cell}>
                {d}
              </Txt>
            ))}
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.cell} />;
              const done = completed.has(day);
              const some = partial.has(day);
              const future = day > today;
              return (
                <MotionPressable key={day} accessibilityRole="button" accessibilityLabel={`${formatDate(day)}${done ? ', completed' : some ? ', partial' : ''}`} disabled={!some} onPress={() => router.push(`/flame/${day}`)} style={styles.cell}>
                  <View style={[styles.dot, { backgroundColor: done ? colors.primary : some ? colors.primarySoft : 'transparent', borderColor: day === today ? colors.primary : 'transparent', borderWidth: day === today ? 2 : 0, opacity: future ? 0.4 : 1 }]}>
                    <Txt variant="caption" weight="600" style={{ color: done ? colors.onPrimary : colors.text }}>
                      {Number(day.slice(-2))}
                    </Txt>
                  </View>
                </MotionPressable>
              );
            })}
          </View>
          <View style={styles.legend}>
            <Legend color={colors.primary} label="Both sent" />
            <Legend color={colors.primarySoft} label="One sent" />
          </View>
        </Card>
      ) : days.length ? (
        <View style={{ gap: spacing.sm }}>
          {days.map((d) => (
            <Card key={d} onPress={() => router.push(`/flame/${d}`)} accessibilityLabel={formatDate(d)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Txt style={{ fontSize: 22 }}>{completed.has(d) ? '🔥' : '🌫️'}</Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{formatDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}</Txt>
                <Txt variant="caption" tone="secondary">
                  {completed.has(d) ? 'Both sent · day counted' : 'Only one of you sent'}
                  {d === addDays(today, 0) ? ' · today' : ''}
                </Txt>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState emoji="📅" title="No moments yet" body="Your history fills in as you send daily moments." />
      )}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
});
