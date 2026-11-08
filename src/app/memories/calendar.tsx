import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Header, Screen, Txt } from '@/components/ui';
import { formatDate, todayKey } from '@/lib/time';
import { useCouple, useMemories } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Calendar of shared moments: tap a day to see that day's memories. */
export default function MemoryCalendar() {
  const { colors } = useTheme();
  const couple = useCouple();
  const memories = useMemories();
  const today = todayKey(couple?.coupleTimezone ?? 'UTC');
  const [cursor, setCursor] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    memories.forEach((x) => m.set(x.takenOn, (m.get(x.takenOn) ?? 0) + 1));
    return m;
  }, [memories]);

  const [y, mo] = cursor.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${cursor}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => setCursor(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7));
  const dayItems = selected ? memories.filter((m) => m.takenOn === selected) : [];

  return (
    <Screen>
      <Header title="Calendar of moments" />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.monthRow}>
          <MotionPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shift(-1)} style={styles.nav}>
            <Txt variant="heading">‹</Txt>
          </MotionPressable>
          <Txt variant="heading">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)}</Txt>
          <MotionPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shift(1)} style={styles.nav}>
            <Txt variant="heading">›</Txt>
          </MotionPressable>
        </View>
        <View style={styles.grid}>
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />;
            const n = counts.get(d) ?? 0;
            return (
              <MotionPressable key={d} accessibilityRole="button" accessibilityLabel={`${formatDate(d)}, ${n} memories`} onPress={() => setSelected(d)} style={styles.cell}>
                <View style={[styles.dot, { backgroundColor: n ? colors.primarySoft : 'transparent', borderWidth: selected === d ? 2 : 0, borderColor: colors.primary }]}>
                  <Txt variant="caption" weight={n ? '700' : '400'}>
                    {Number(d.slice(-2))}
                  </Txt>
                  {n ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 1 }} /> : null}
                </View>
              </MotionPressable>
            );
          })}
        </View>
      </Card>
      {selected ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Txt variant="heading">{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</Txt>
          {dayItems.length ? dayItems.map((m) => (
            <Card key={m.id} onPress={() => router.push(`/memories/${m.id}`)}>
              <Txt variant="bodyStrong">{m.title ?? m.caption ?? (m.kind === 'moment' ? 'Daily moment' : m.kind)}</Txt>
              <Txt variant="caption" tone="muted">
                {m.kind}
              </Txt>
            </Card>
          )) : (
            <Txt tone="muted">No memories on this day.</Txt>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
