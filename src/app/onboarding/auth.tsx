import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Banner, Button, Card, toast, Txt } from '@/components/ui';
import { backend, remoteConfig } from '@/services/backend';
import { useOnboarding } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

/** Account creation choice. Theme + answers are already saved locally and survive sign-in. */
export default function AuthChoiceStep() {
  const draft = useOnboarding();
  const [loading, setLoading] = useState(false);

  const demo = async () => {
    setLoading(true);
    try {
      await backend.startDemo();
      backend.saveOnboarding({ step: 5 });
      router.push('/onboarding/couple');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingFrame step="auth" title={`Nice to meet you${draft.firstName ? `, ${draft.firstName}` : ''}`} subtitle="An account lets you sync with your partner across devices. Your theme and answers are kept either way.">
      <View style={{ gap: spacing.md }}>
        <Button title="Create an account" size="lg" onPress={() => router.push('/auth/sign-up')} />
        <Button title="I already have an account" variant="secondary" onPress={() => router.push('/auth/sign-in')} />
        <Card tint style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Txt variant="heading">Just looking?</Txt>
          <Txt tone="secondary">Explore the full app with a simulated partner. Everything stays on this device, and nothing you send reaches a real person.</Txt>
          <Button title="Explore a demo" variant="outline" onPress={demo} loading={loading} />
        </Card>
        {!remoteConfig.configured ? (
          <Banner kind="info" title="Accounts are local in this build" body="No server is configured yet, so accounts and pairing run on this device only. Real multi-device sync needs the backend described in docs/BACKEND.md." />
        ) : null}
        <Txt variant="caption" tone="muted" center style={{ marginTop: spacing.md }}>
          Apple and Google sign-in appear here once their credentials are configured.
        </Txt>
      </View>
    </OnboardingFrame>
  );
}
