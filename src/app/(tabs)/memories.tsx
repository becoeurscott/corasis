import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MediaThumb } from '@/components/MediaThumb';
import { Banner, Button, Card, Chip, EmptyState, Input, Screen, SectionTitle, Txt } from '@/components/ui';
import { formatDate, todayKey } from '@/lib/time';
import { Memory, MemoryKind, useData } from '@/services/backend';
import { useCouple, useMe, useMemories } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const filters: { v: MemoryKind | 'all' | 'favorites'; l: string }[] = [
  { v: 'all', l: 'All' },
  { v: 'moment', l: 'Daily moments' },
  { v: 'photo', l: 'Photos' },
  { v: 'video', l: 'Videos' },
  { v: 'voice', l: 'Voice notes' },
  { v: 'letter', l: 'Letters' },
  { v: 'favorites', l: 'Favorites' },
];
const PAGE = 24;

export default function MemoriesTab() {
  const { colors } = useTheme();
  const me = useMe();
  const couple = useCouple();
  const memories = useMemories();
  const profiles = useData((s) => s.profiles);
  const [filter, setFilter] = useState<(typeof filters)[number]['v']>('all');
  const [view, setView] = useState<'timeline' | 'grid'>('timeline');
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const today = todayKey(couple?.coupleTimezone ?? me?.timezone ?? 'UTC');
  const onThisDay = useMemo(() => memories.filter((m) => m.takenOn.slice(5) === today.slice(5) && m.takenOn !== today), [memories, today]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return memories
      .filter((m) => filter === 'all' || (filter === 'favorites' ? !!me && m.favoritedBy.includes(me.id) : m.kind === filter))
      .filter((m) => !needle || `${m.caption ?? ''} ${m.title ?? ''} ${m.body ?? ''}`.toLowerCase().includes(needle))
      .filter((m) => !month || m.takenOn.startsWith(month))
      .sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt));
  }, [memories, filter, q, month, me]);
  const page = list.slice(0, limit);

  const grouped = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of page) {
      const key = m.takenOn.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [page]);

  if (!me) return null;

  return (
    <Screen edges={['top']}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="title">Memories</Txt>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Button title="Calendar" variant="ghost" size="sm" full={false} onPress={() => router.push('/memories/calendar')} />
            <Button title="＋ Add" size="sm" full={false} onPress={() => router.push('/memories/new')} />
          </View>
        </View>
        {!couple ? <Banner kind="info" body="Your private album starts once you connect with your partner. Everything here is visible only to the two of you." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} /> : null}

        {onThisDay.length ? (
          <Card tint onPress={() => router.push(`/memories/${onThisDay[0].id}`)} accessibilityLabel="On this day" style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <MediaThumb media={onThisDay[0].media} style={{ width: 72, aspectRatio: 1 }} static />
            <View style={{ flex: 1 }}>
              <Txt variant="label" tone="primary">
                On this day
              </Txt>
              <Txt variant="bodyStrong">{formatDate(onThisDay[0].takenOn, { year: 'numeric', month: 'long', day: 'numeric' })}</Txt>
              <Txt variant="caption" tone="secondary" numberOfLines={2}>
                {onThisDay[0].caption ?? onThisDay[0].title ?? 'A memory from the archive'}
              </Txt>
            </View>
          </Card>
        ) : null}

        <Input value={q} onChangeText={setQ} placeholder="Search captions and letters" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {filters.map((f) => (
            <Chip key={f.v} label={f.l} selected={filter === f.v} onPress={() => { setFilter(f.v); setLimit(PAGE); }} small />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Chip label="Timeline" selected={view === 'timeline'} onPress={() => setView('timeline')} small />
          <Chip label="Grid" selected={view === 'grid'} onPress={() => setView('grid')} small />
          <View style={{ flex: 1 }}>
            <Input value={month} onChangeText={setMonth} placeholder="Month YYYY-MM" autoCapitalize="none" />
          </View>
        </View>

        {page.length === 0 ? (
          <EmptyState emoji="📖" title={memories.length ? 'Nothing matches' : 'Your album is empty'} body={memories.length ? 'Try another filter or search.' : 'Daily moments land here automatically. You can also add photos, voice notes and letters.'} actionTitle={memories.length ? undefined : 'Add a memory'} onAction={() => router.push('/memories/new')} />
        ) : view === 'grid' ? (
          <View style={styles.grid}>
            {page.map((m) => (
              <View key={m.id} style={styles.gridCell}>
                {m.kind === 'letter' || m.kind === 'voice' ? (
                  <Card tint onPress={() => router.push(`/memories/${m.id}`)} accessibilityLabel={m.title ?? m.kind} style={styles.gridTile}>
                    <Txt style={{ fontSize: 26 }}>{m.kind === 'letter' ? '✉️' : '🎤'}</Txt>
                    <Txt variant="caption" numberOfLines={2} center>
                      {m.title ?? (m.kind === 'voice' ? 'Voice note' : 'Letter')}
                    </Txt>
                  </Card>
                ) : (
                  <MediaThumb media={m.media} style={{ aspectRatio: 1 }} openViewer={false} onPress={() => router.push(`/memories/${m.id}`)} label={m.caption ?? undefined} />
                )}
              </View>
            ))}
          </View>
        ) : (
          grouped.map(([monthKey, items]) => (
            <View key={monthKey} style={{ gap: spacing.sm }}>
              <SectionTitle title={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${monthKey}-01T00:00:00Z`))} />
              {items.map((m) => {
                const owner = profiles[m.ownerId];
                const fav = m.favoritedBy.includes(me.id);
                return (
                  <Card key={m.id} onPress={() => router.push(`/memories/${m.id}`)} accessibilityLabel={m.caption ?? m.title ?? m.kind} style={{ flexDirection: 'row', gap: spacing.md }}>
                    {m.kind === 'letter' || m.kind === 'voice' ? (
                      <View style={[styles.iconTile, { backgroundColor: colors.surfaceTint }]}>
                        <Txt style={{ fontSize: 28 }}>{m.kind === 'letter' ? '✉️' : '🎤'}</Txt>
                      </View>
                    ) : (
                      <MediaThumb media={m.media} style={{ width: 84, aspectRatio: 1 }} static />
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="caption" tone="primary" weight="700">
                        {m.kind === 'moment' ? 'Daily moment' : m.kind[0].toUpperCase() + m.kind.slice(1)} · {formatDate(m.takenOn, { month: 'short', day: 'numeric' })}
                      </Txt>
                      <Txt variant="bodyStrong" numberOfLines={1}>
                        {m.title ?? m.caption ?? (m.kind === 'voice' ? 'Voice note' : 'Untitled')}
                      </Txt>
                      <Txt variant="caption" tone="muted">
                        by {owner?.firstName ?? '?'}{owner?.isSimulated ? ' (simulated)' : ''}{fav ? ' · ★' : ''}
                      </Txt>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))
        )}
        {list.length > limit ? <Button title={`Load more (${list.length - limit} left)`} variant="secondary" onPress={() => setLimit(limit + PAGE)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCell: { width: '31.5%', flexGrow: 1 },
  gridTile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconTile: { width: 84, height: 84, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
