import { router } from 'expo-router';
import React, { useEffect } from 'react';

import { Banner, Button, Card, Header, Screen, Txt } from '@/components/ui';
import { dailyQuestionFor } from '@/data/questions';
import { todayKey } from '@/lib/time';
import { backend } from '@/services/backend';
import { useCouple, useMe } from '@/store/hooks';

/** Resolves (or creates) today's daily session and forwards to it. */
export default function DailyQuestion() {
  const couple = useCouple();
  const me = useMe();
  useEffect(() => {
    if (couple) router.replace(`/activity/session/${backend.dailySession().id}`);
  }, [couple]);
  if (!couple) {
    const q = dailyQuestionFor(todayKey(me?.timezone ?? 'UTC'));
    return (
      <Screen>
        <Header title="Daily question" />
        <Card tint style={{ gap: 8 }}>
          <Txt variant="heading">{q.text}</Txt>
          <Txt tone="secondary">Think about it today. Once you connect with your partner you can both answer and reveal together.</Txt>
        </Card>
        <Banner kind="info" body="Not connected yet." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }
  return null;
}
