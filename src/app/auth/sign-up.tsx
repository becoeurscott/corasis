import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Header, Input, Screen, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { spacing } from '@/theme/tokens';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const { verificationCode } = await backend.signUp(email, password);
      backend.saveOnboarding({ step: 4 });
      router.replace({ pathname: '/auth/verify', params: { demoCode: verificationCode } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button title="Create account" onPress={submit} loading={loading} disabled={!email || !password || !confirm} size="lg" />}>
      <Header title="Create your account" />
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <Txt tone="secondary">We only use your email to sign you in and to send a verification code.</Txt>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters." />
        <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry error={error} onSubmitEditing={submit} returnKeyType="go" />
        <Button title="I already have an account" variant="ghost" onPress={() => router.replace('/auth/sign-in')} />
      </View>
    </Screen>
  );
}
