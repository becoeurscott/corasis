import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppMark } from '@/components/AppMark';
import { Button, Input, Screen, Txt } from '@/components/ui';
import { useLock } from '@/store/lock';
import { usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';
import { askPermission } from '@/lib/permissions';

export default function LockScreen() {
  const pin = usePrefs((s) => s.appLockPin);
  const setLocked = useLock((s) => s.setLocked);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);

  const unlock = () => {
    setLocked(false);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.hasHardwareAsync()
      .then(async (has) => has && (await LocalAuthentication.isEnrolledAsync()))
      .then((ok) => setBioAvailable(!!ok))
      .catch(() => setBioAvailable(false));
  }, []);

  const tryBiometrics = async () => {
    try {
      if (!(await askPermission('faceID'))) return;
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Together' });
      if (res.success) unlock();
      else setError('Biometric check did not succeed. Use your PIN instead.');
    } catch {
      setError('Biometrics unavailable right now. Use your PIN.');
    }
  };

  useEffect(() => {
    if (!bioAvailable) return;
    const t = setTimeout(tryBiometrics, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAvailable]);

  const submit = () => {
    if (entry === pin) unlock();
    else {
      setError('That PIN does not match.');
      setEntry('');
    }
  };

  return (
    <Screen scroll={false} contentStyle={styles.center}>
      <View style={{ alignItems: 'center', gap: spacing.lg, width: '100%' }}>
        <AppMark size={88} onLight />
        <Txt variant="title">Together is locked</Txt>
        <Txt tone="secondary" center>
          Enter your PIN{bioAvailable ? ' or use biometrics' : ''} to continue.
        </Txt>
        <View style={{ width: '100%', gap: spacing.md }}>
          <Input label="PIN" value={entry} onChangeText={(v) => { setEntry(v.replace(/\D/g, '').slice(0, 6)); setError(null); }} keyboardType="number-pad" secureTextEntry maxLength={6} error={error} onSubmitEditing={submit} returnKeyType="done" />
          <Button title="Unlock" onPress={submit} disabled={entry.length < 4} />
          {bioAvailable ? <Button title="Use Face ID / fingerprint" variant="ghost" onPress={tryBiometrics} /> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { justifyContent: 'center', alignItems: 'center' } });
