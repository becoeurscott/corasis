import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Banner, Button, Card, Header, Input, ListItem, Screen, toast, Txt } from '@/components/ui';
import { useLock } from '@/store/lock';
import { usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';

export default function AppLockSettings() {
  const enabled = usePrefs((s) => s.appLockEnabled);
  const setAppLock = usePrefs((s) => s.setAppLock);
  const setLocked = useLock((s) => s.setLocked);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [bio, setBio] = useState<string>(Platform.OS === 'web' ? 'Biometrics are not available in the browser; the PIN still works.' : 'Checking…');
  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.hasHardwareAsync().then(async (has) => {
      const enrolled = has && (await LocalAuthentication.isEnrolledAsync());
      setBio(enrolled ? 'Face ID / fingerprint will be offered first; the PIN is the fallback.' : 'No biometrics enrolled on this device; the PIN will be used.');
    });
  }, []);
  const enable = () => {
    if (pin.length < 4) return toast('Use at least 4 digits.', 'error');
    if (pin !== confirm) return toast('PINs do not match.', 'error');
    setAppLock(true, pin);
    setLocked(false);
    toast('App lock enabled', 'success');
    setPin('');
    setConfirm('');
  };
  return (
    <Screen>
      <Header title="App lock" />
      <View style={{ gap: spacing.lg }}>
        <Card>
          <ListItem icon="lock-closed" title="Require unlock" subtitle="On open and when returning from the background" toggle={enabled} onToggle={(v) => { if (!v) { setAppLock(false, null); setLocked(false); } else toast('Set a PIN below to enable.'); }} />
        </Card>
        {!enabled ? (
          <Card style={{ gap: spacing.md }}>
            <Input label="PIN (4–6 digits)" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry />
            <Input label="Confirm PIN" value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry />
            <Button title="Enable app lock" onPress={enable} disabled={pin.length < 4} />
          </Card>
        ) : null}
        <Txt variant="caption" tone="secondary">
          {bio}
        </Txt>
        <Banner kind="info" title="What app lock does" body="It protects re-entry into the app and hides the app-switcher preview on devices that support it. It does not encrypt stored content and does not replace your account's server-side authorization. In this preview the PIN is stored in app preferences; the production build moves it to the secure keychain (expo-secure-store)." />
      </View>
    </Screen>
  );
}
