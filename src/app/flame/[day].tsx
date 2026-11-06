import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { MediaThumb } from '@/components/MediaThumb';
import { Avatar, Banner, Card, EmptyState, Header, Screen, Txt } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/time';
import { useData } from '@/services/backend';
import { useCouple, useMoments } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function DayDetail() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const couple = useCouple();
  const moments = useMoments().filter((m) => m.dayKey === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const profiles = useData((s) => s.profiles);
  const authors = new Set(moments.map((m) => m.authorId));
  const complete = !!couple && couple.memberIds.every((id) => authors.has(id));

  return (
    <Screen>
      <Header title={day ? formatDate(day, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Moment'} />
      {moments.length ? (
        <View style={{ gap: spacing.lg }}>
          <Banner kind={complete ? 'success' : 'info'} body={complete ? 'Both of you sent a moment. This day counts toward the flame.' : 'Only one moment this day, so it did not count. No big deal.'} />
          {moments.map((m) => {
            const p = profiles[m.authorId];
            return (
              <Card key={m.id} padded={false} style={{ overflow: 'hidden' }}>
                <MediaThumb media={m.media} label={m.caption ?? `${p?.firstName}'s moment`} style={{ borderRadius: 0 }} />
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Avatar name={p?.firstName ?? '?'} uri={p?.avatarUri} size={28} simulated={p?.isSimulated} />
                    <Txt variant="bodyStrong">{p?.firstName}</Txt>
                    <Txt variant="caption" tone="muted">
                      · {relativeTime(m.createdAt)}
                    </Txt>
                  </View>
                  {m.caption ? <Txt>{m.caption}</Txt> : null}
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState emoji="🌫️" title="No moments on this day" />
      )}
    </Screen>
  );
}
