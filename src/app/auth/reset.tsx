import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Header, Input, Screen, toast, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { spacing } from '@/theme/tokens';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = async () => {
    setLoading(true);
    const r = await backend.requestPasswordReset(email);
    setDemoCode(r.resetCode);
    setSent(true);
    setLoading(false);
  };
  const reset = async () => {
    setLoading(true);
    setError(null);
    try {
      await backend.resetPassword(email, code, password);
      toast('Password updated. Sign in with your new password.', 'success');
      router.replace('/auth/sign-in');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={sent ? <Button title="Set new password" onPress={reset} loading={loading} disabled={code.length < 6 || password.length < 8} size="lg" /> : <Button title="Send reset code" onPress={request} loading={loading} disabled={!email} size="lg" />}>
      <Header title="Reset password" />
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        {!sent ? (
          <>
            <Txt tone="secondary">Enter your email. If an account exists, we send a reset code.</Txt>
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          </>
        ) : (
          <>
            <Txt tone="secondary">If {email} has an account, a code is on its way.</Txt>
            {demoCode ? <Banner kind="demo" title="No email service in this build" body={`Your reset code is ${demoCode}.`} /> : <Banner kind="info" body="No account matches this email on this device, so no code was generated." />}
            <Input label="Reset code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
            <Input label="New password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 8 characters." error={error} />
          </>
        )}
      </View>
    </Screen>
  );
}
