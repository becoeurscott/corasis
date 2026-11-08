import product from '../../../shared/product.json';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Card, Input, Screen, toast, Txt } from '@/components/ui';
import { resolveStartRoute } from '@/lib/routing';
import { backend, useData } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { useTheme } from '@/theme/ThemeProvider';

import { FieldIcon, PrivacyFold, SocialButtons, useSocialSignIn } from './AuthBits';

const codeCopy = product.emailCode;

/** Passwordless email flow shared by sign-in and sign-up: email → 6-digit code from InsForge → signed in. */
export function EmailCodeCard() {
  const { colors } = useTheme();
  const social = useSocialSignIn();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const head = { title: product.signIn.title, subtitle: product.signIn.subtitle, placeholder: product.signIn.emailPlaceholder, action: product.signIn.action };

  const send = async (again = false) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const target = again && sentTo ? sentTo : email.trim();
      const { demoCode: dc } = await backend.sendEmailCode(target);
      setSentTo(target.toLowerCase());
      setDemoCode(dc);
      if (again) toast(codeCopy.resent, 'success');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (loading || !sentTo) return;
    setError(null);
    setLoading(true);
    try {
      await backend.verifyEmailCode(sentTo, code);
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
    <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }} style={{ backgroundColor: colors.primarySoft }}>
      <Card style={{ padding: 24, borderRadius: 30, gap: 22 }}>
        {sentTo ? (
          <>
            <View style={{ gap: 8 }}>
              <Txt variant="title">{codeCopy.title}</Txt>
              <Txt tone="secondary">{codeCopy.subtitle.replace('{email}', sentTo)}</Txt>
            </View>
            {demoCode ? <Banner kind="demo" title="Local preview" body={codeCopy.demo.replace('{code}', demoCode)} /> : null}
            <Input rounded left={<FieldIcon name="keypad-outline" />} accessibilityLabel="Verification code" placeholder={codeCopy.placeholder} value={code}
              onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
              keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} error={error} onSubmitEditing={verify} returnKeyType="go" autoFocus />
            <Button title={codeCopy.action} onPress={verify} loading={loading} disabled={code.length < 6} size="lg" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button title={codeCopy.change} variant="ghost" onPress={() => { setSentTo(null); setCode(''); setError(null); }} />
              <Button title={codeCopy.resend} variant="ghost" onPress={() => send(true)} />
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Txt variant="title">{head.title}</Txt>
              <Txt tone="secondary">{head.subtitle}</Txt>
            </View>
            <Input rounded left={<FieldIcon name="mail-outline" />} accessibilityLabel="Email address" value={email} onChangeText={(v) => { setEmail(v); setError(null); }}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder={head.placeholder} error={error} onSubmitEditing={() => send()} returnKeyType="next" />
            <Button title={head.action} onPress={() => send()} loading={loading} disabled={!email.trim()} size="lg" />
            <SocialButtons onPress={social.run} busy={social.busy} />
          </>
        )}
        <PrivacyFold note={product.accountCreation.privacyNote} />
      </Card>
    </Screen>
  );
}
