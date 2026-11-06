import React from 'react';
import { View } from 'react-native';

import { Card, Header, Screen, Txt } from '@/components/ui';
import { remoteConfig } from '@/services/backend';
import { spacing } from '@/theme/tokens';

/** Factual privacy copy, derived from what this build actually does. */
export default function PrivacyPolicy() {
  return (
    <Screen>
      <Header title="Privacy & terms" />
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">What this build stores</Txt>
          <Txt tone="secondary">{remoteConfig.configured ? 'Your profile, couple, moments, answers, messages, memories and calendar are stored on the configured server and cached on this device.' : 'No server is configured. Everything you enter — profile, couple details, moments, answers, messages, memories, calendar and preferences — is stored only on this device. Nothing is sent to a server.'}</Txt>
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Who can see what</Txt>
          <Txt tone="secondary">Content inside a couple is visible to its two members only. Answers to activities stay hidden from your partner until both of you submit. Location and battery are shared only while you have the switch on, and are removed for your partner the moment you turn it off.</Txt>
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Media</Txt>
          <Txt tone="secondary">Photos, videos and voice notes are kept in private storage. On a server build, media is served through authorized, expiring links, never public URLs. Deleting a memory removes its album entry; if it was a daily moment, the moment is removed too and the day may no longer count.</Txt>
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">What we do not claim</Txt>
          <Txt tone="secondary">This app does not use end-to-end encryption. App lock protects re-entry, not stored data. Notifications are only "delivered" when the system confirms it; queued items are labeled as such.</Txt>
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Your rights</Txt>
          <Txt tone="secondary">Export your data, unlink your partner, or delete your account from Profile → Your data. One person can never delete the other's account. After unlinking, shared content remains exportable for 30 days on a server build, then is deleted.</Txt>
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Terms (short version)</Txt>
          <Txt tone="secondary">Be kind to each other. Do not upload content you do not have the right to share. Quizzes and streaks are games, not measures of your relationship. We may change features; we will tell you when we do.</Txt>
        </Card>
      </View>
    </Screen>
  );
}
