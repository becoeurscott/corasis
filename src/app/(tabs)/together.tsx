import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Banner, Card, Chip, Input, Screen, SectionTitle, Txt } from '@/components/ui';
import { categoryMeta, dailyQuestionFor, decks } from '@/data/questions';
import { todayKey } from '@/lib/time';
import { DeckCategory } from '@/services/backend';
import { useCouple, useDailySession, useEntitlements, useMe, useMessages, usePartner, useSessions } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const categories = Object.keys(categoryMeta) as DeckCategory[];

export default function TogetherTab() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const sessions = useSessions();
  const messages = useMessages();
  const ent = useEntitlements();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<DeckCategory | null>(null);

  const today = todayKey(couple?.coupleTimezone ?? me?.timezone ?? 'UTC');
  const dailyQ = dailyQuestionFor(today);
  const daily = useDailySession();
  const unread = me ? messages.filter((m) => m.senderId !== me.id && !m.readAt).length : 0;
  const waiting = me ? sessions.filter((s) => s.status === 'waiting' && !s.submissions.some((x) => x.userId === me.id)) : [];

  const filtered = useMemo(() => decks.filter((d) => (!cat || d.category === cat) && (!q || `${d.title} ${d.description} ${categoryMeta[d.category].label}`.toLowerCase().includes(q.toLowerCase()))), [q, cat]);
  const featured = decks.slice(0, 5);

  return (
    <Screen edges={['top']}>
      <View style={{ gap: spacing.md }}>
        <Txt variant="title">Together</Txt>
        {!couple ? <Banner kind="info" body="You can browse every activity now. Answering together needs a connected partner." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} /> : null}

        <Card onPress={() => router.push('/messages')} accessibilityLabel="Messages" style={styles.rowCard}>
          <View style={[styles.emojiBox, { backgroundColor: colors.primarySoft }]}>
            <Txt style={{ fontSize: 22 }}>💌</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">Messages & affection</Txt>
            <Txt variant="caption" tone="secondary">
              {unread ? `${unread} unread` : 'Kisses, hugs, notes and voice notes'}
            </Txt>
          </View>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Txt variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                {unread}
              </Txt>
            </View>
          ) : null}
        </Card>

        <Card onPress={() => router.push('/games')} accessibilityLabel="Games" style={[styles.rowCard, styles.gamesCard]}>
          <View style={[styles.emojiBox, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Txt style={{ fontSize: 22 }}>🎮</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" style={{ color: '#FFFFFF' }}>
              Games for two
            </Txt>
            <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Draw, puzzle and duel, one turn at a time
            </Txt>
          </View>
          <Txt variant="label" style={{ color: '#FFFFFF' }}>
            NEW
          </Txt>
        </Card>

        <Card onPress={() => router.push('/activity/daily')} tint style={{ gap: 4 }}>
          <Txt variant="label" tone="primary">
            Daily question
          </Txt>
          <Txt variant="heading">{dailyQ.text}</Txt>
          <Txt variant="caption" tone="muted">
            {daily?.status === 'revealed' ? 'Revealed · tap to see both answers' : daily?.submissions.length ? `Waiting for ${partner?.firstName ?? 'partner'}` : 'Tap to answer'}
          </Txt>
        </Card>

        {waiting.length ? <Banner kind="info" body={`${partner?.firstName} answered ${waiting.length} ${waiting.length === 1 ? 'question' : 'questions'} and is waiting for you.`} actionTitle="Open" onAction={() => router.push(`/activity/session/${waiting[0].id}`)} /> : null}

        <SectionTitle title="Play" action="History" onAction={() => router.push('/activity/history')} />
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          {featured.map((d) => (
            <Card key={d.id} onPress={() => router.push(`/activity/${d.id}`)} accessibilityLabel={d.title} style={styles.featured}>
              <Txt style={{ fontSize: 30 }}>{d.emoji}</Txt>
              <Txt variant="bodyStrong" numberOfLines={2}>
                {d.title}
              </Txt>
              <Txt variant="caption" tone="muted">
                {d.questionIds.length} prompts
              </Txt>
            </Card>
          ))}
        </ScrollView>

        <SectionTitle title="Conversation decks" action="Favorites" onAction={() => router.push('/activity/favorites')} />
        <Input value={q} onChangeText={setQ} placeholder="Search decks" autoCorrect={false} />
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="All" selected={!cat} onPress={() => setCat(null)} small />
          {categories.map((c) => (
            <Chip key={c} label={`${categoryMeta[c].emoji} ${categoryMeta[c].label}`} selected={cat === c} onPress={() => setCat(cat === c ? null : c)} small />
          ))}
        </ScrollView>
        <View style={{ gap: spacing.sm }}>
          {filtered.map((d) => (
            <Card key={d.id} onPress={() => router.push(`/activity/${d.id}`)} accessibilityLabel={d.title} style={styles.rowCard}>
              <View style={[styles.emojiBox, { backgroundColor: colors.surfaceTint }]}>
                <Txt style={{ fontSize: 22 }}>{d.emoji}</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{d.title}</Txt>
                <Txt variant="caption" tone="secondary" numberOfLines={2}>
                  {d.description}
                </Txt>
              </View>
              {d.premium && !ent.premium ? (
                <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}>
                  <Txt variant="caption" style={{ color: colors.warning, fontWeight: '700' }}>
                    Plus
                  </Txt>
                </View>
              ) : null}
            </Card>
          ))}
          {!filtered.length ? (
            <Txt tone="muted" center>
              No decks match that search.
            </Txt>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emojiBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  featured: { width: 150, gap: 6 },
  gamesCard: { backgroundColor: '#15101A', borderColor: '#15101A' },
});
