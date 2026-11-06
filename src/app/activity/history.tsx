import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Card, Chip, EmptyState, Header, Screen, Txt } from '@/components/ui';
import { deckById, questionById } from '@/data/questions';
import { relativeTime } from '@/lib/time';
import { useMe, useSessions } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function ActivityHistory() {
  const me = useMe();
  const sessions = useSessions();
  const [filter, setFilter] = useState<'all' | 'waiting' | 'revealed'>('all');
  const list = sessions.filter((s) => s.status !== 'abandoned' && (filter === 'all' || (filter === 'waiting' ? s.status !== 'revealed' : s.status === 'revealed')));
  return (
    <Screen>
      <Header title="Activity history" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} small />
        <Chip label="Open" selected={filter === 'waiting'} onPress={() => setFilter('waiting')} small />
        <Chip label="Revealed" selected={filter === 'revealed'} onPress={() => setFilter('revealed')} small />
      </View>
      {list.length ? (
        <View style={{ gap: spacing.sm }}>
          {list.map((s) => {
            const q = questionById(s.questionId);
            const d = deckById(s.deckId);
            const mine = me ? s.submissions.some((x) => x.userId === me.id) : false;
            const label = s.status === 'revealed' ? 'Revealed' : mine ? 'Waiting for partner' : s.status === 'waiting' ? 'Your turn' : 'Not started';
            return (
              <Card key={s.id} onPress={() => router.push(`/activity/session/${s.id}`)} accessibilityLabel={q?.text}>
                <Txt variant="caption" tone="primary" weight="700">
                  {d?.emoji} {d?.title} · {label}
                </Txt>
                <Txt numberOfLines={2}>{q?.type === 'would_you_rather' ? `${q.options?.[0]} or ${q.options?.[1]}?` : q?.text}</Txt>
                <Txt variant="caption" tone="muted">
                  {relativeTime(s.revealedAt ?? s.createdAt)}
                </Txt>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState emoji="🗂️" title="No activities yet" body="Start with the daily question." actionTitle="Daily question" onAction={() => router.push('/activity/daily')} />
      )}
    </Screen>
  );
}
