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
    <OnboardingFrame step="auth" title={`Nice to meet you${draft.firstName ? `, ${draft.firstName}` : ''}`} subtitle="Keep your profile and private preferences.">
      <View style={{ gap: spacing.md }}>
        <Button title="Continue with email" size="lg" onPress={() => router.push('/auth/sign-in')} />
        <Card tint style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Txt variant="heading">Just looking?</Txt>
          <Txt tone="secondary">Try it with a simulated partner.</Txt>
          <Button title="Explore a demo" variant="outline" onPress={demo} loading={loading} />
        </Card>
        {!remoteConfig.configured ? (
          <Banner kind="info" title="Accounts are local in this build" body="Local preview. Your data stays on this device." />
        ) : null}

      </View>
    </OnboardingFrame>
  );
}
