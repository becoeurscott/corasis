import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Header, Input, Screen, Txt } from '@/components/ui';
import { resolveStartRoute } from '@/lib/routing';
import { backend, useData } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await backend.signIn(email, password);
      backend.saveOnboarding({ step: 4 });
      const { onboarding, session, pendingInviteCode } = useData.getState();
      router.replace(resolveStartRoute({ theme: usePrefs.getState().theme, onboarding, session, couple: backend.couple(), pendingInviteCode }) as never);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button title="Sign in" onPress={submit} loading={loading} disabled={!email || !password} size="lg" />}>
      <Header title="Welcome back" />
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" error={error} onSubmitEditing={submit} returnKeyType="go" />
        <Button title="Forgot password?" variant="ghost" onPress={() => router.push('/auth/reset')} />
        <Txt variant="caption" tone="muted" center>
          Your session is restored automatically next time you open the app.
        </Txt>
        <Button title="Create an account instead" variant="ghost" onPress={() => router.replace('/auth/sign-up')} />
      </View>
    </Screen>
  );
}
