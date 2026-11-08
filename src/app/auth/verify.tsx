import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Header, Input, Screen, toast, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useSession } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function Verify() {
  const session = useSession();
  const params = useLocalSearchParams<{ demoCode?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState<string | undefined>(params.demoCode);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await backend.verifyEmail(code);
      toast('Email verified', 'success');
      router.replace('/onboarding/partner');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button title="Verify" onPress={submit} loading={loading} disabled={code.length < 6} size="lg" />}>
      <Header title="Check your email" />
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <Txt tone="secondary">We sent a 6-digit code to {session?.email ?? 'your email'}. Enter it below.</Txt>
        {shown ? <Banner kind="demo" title="No email service in this build" body={`Your verification code is ${shown}. A configured backend would email it instead.`} /> : null}
        <Input label="Verification code" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }} keyboardType="number-pad" maxLength={6} error={error} onSubmitEditing={submit} />
        <Button title="Resend code" variant="ghost" onPress={async () => { try { const r = await backend.resendVerification(); if (r.verificationCode) setShown(r.verificationCode); toast('Code resent'); } catch (e) { toast((e as Error).message, 'error'); } }} />
        <Button title="Use a different account" variant="ghost" onPress={async () => { await backend.signOut(); router.replace('/onboarding/auth'); }} />
      </View>
    </Screen>
  );
}
