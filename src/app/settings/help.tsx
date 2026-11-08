import { MotionPressable } from '@/components/ui/MotionPressable';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Header, Screen, Txt } from '@/components/ui';
import { spacing } from '@/theme/tokens';

const faq = [
  ['How does the flame work?', 'Each of you sends at least one photo or video in a day (in your couple time zone). The day counts once, no matter how many you send. If a day is missed the streak restarts; your longest streak is kept.'],
  ['Can my partner see my answer before I see theirs?', 'No. Answers are kept hidden by the server until both of you submit. Once revealed, answers are locked.'],
  ['Is my location tracked?', 'Only if you switch it on, only while the app is open, and never as a history. Turn it off any time; your position disappears for your partner immediately.'],
  ['What happens if we unlink?', 'Both lose access to shared content right away. On a server build you can export shared content for 30 days before it is deleted. Your own account stays.'],
  ['Why do widgets update slowly?', 'iOS and Android decide when widgets refresh, usually within 15–30 minutes. Opening the app refreshes them.'],
  ['Is this therapy?', 'No. "Communication and repair" prompts are gentle conversation starters, not professional advice. Quiz results are for fun only.'],
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen>
      <Header title="Help & FAQ" />
      <View style={{ gap: spacing.sm }}>
        {faq.map(([q, a], i) => (
          <Card key={q} padded={false}>
            <MotionPressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)} style={{ padding: spacing.lg, minHeight: 52 }}>
              <Txt variant="bodyStrong">{q}</Txt>
            </MotionPressable>
            {open === i ? (
              <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
                <Txt tone="secondary">{a}</Txt>
              </View>
            ) : null}
          </Card>
        ))}
        <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Txt variant="heading">Contact support</Txt>
          <Txt tone="secondary">Something broken or confusing? Write to us; we read everything.</Txt>
          <Button title="Email support" variant="secondary" onPress={() => Linking.openURL('mailto:support@together.app?subject=Together%20app')} />
        </Card>
      </View>
    </Screen>
  );
}
