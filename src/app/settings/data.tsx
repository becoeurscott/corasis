import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Banner, Button, Card, Header, Input, Screen, toast, Txt, useConfirm } from '@/components/ui';
import { backend, cancelSimulations } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { useLock } from '@/store/lock';
import { useMe, usePartner, useSession } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function DataSettings() {
  const session = useSession();
  const me = useMe();
  const partner = usePartner();
  const ask = useConfirm((s) => s.ask);
  const params = useLocalSearchParams<{ signout?: string }>();
  const [confirmText, setConfirmText] = useState('');

  const signOut = async () => {
    const ok = await ask({ title: 'Sign out?', body: 'Your data stays on this device and you can sign back in any time.', confirmTitle: 'Sign out' });
    if (!ok) return;
    cancelSimulations();
    await backend.signOut();
    useLock.getState().setLocked(false);
    router.replace('/');
  };

  useEffect(() => {
    if (params.signout === '1') signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.signout]);

  const exportData = async () => {
    const json = backend.exportData();
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(json);
      toast('Export copied to clipboard as JSON', 'success');
      return;
    }
    try {
      await Share.share({ message: json, title: 'together-export.json' });
    } catch {
      await Clipboard.setStringAsync(json);
      toast('Export copied to clipboard', 'success');
    }
  };

  const deleteAccount = async () => {
    const ok = await ask({ title: 'Delete your account?', body: `This deletes your profile and your own content. ${partner ? `${partner.firstName}'s account is not affected, but the couple is unlinked and shared content becomes unavailable to both of you.` : ''} This cannot be undone.`, confirmTitle: 'Delete my account', destructive: true });
    if (!ok) return;
    cancelSimulations();
    await backend.deleteAccount();
    usePrefs.getState().setAppLock(false, null);
    toast('Account deleted');
    router.replace('/');
  };

  const resetDemo = async () => {
    const ok = await ask({ title: 'Reset everything on this device?', body: 'Removes all accounts, the demo couple and preferences. The app restarts at theme selection.', confirmTitle: 'Reset', destructive: true });
    if (!ok) return;
    cancelSimulations();
    await backend.resetAll();
    usePrefs.getState().reset();
    router.replace('/');
  };

  return (
    <Screen>
      <Header title="Your data" />
      <View style={{ gap: spacing.lg }}>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Export</Txt>
          <Txt tone="secondary">A JSON file with your profile, couple details, moments, revealed answers, messages, memories and calendar. Media is referenced by URI.</Txt>
          <Button title="Export my data" variant="secondary" onPress={exportData} />
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Partner</Txt>
          <Txt tone="secondary">{partner ? `Unlinking revokes access to shared content for both of you immediately.` : 'You are not connected to a partner.'}</Txt>
          <Button title="Manage connection" variant="secondary" onPress={() => router.push('/settings/partner')} />
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Sign out</Txt>
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading" tone="danger">
            Delete account
          </Txt>
          <Txt tone="secondary">Type your first name to confirm. {session?.demo ? 'In demo mode this removes the demo account.' : ''}</Txt>
          <Input value={confirmText} onChangeText={setConfirmText} placeholder={me?.firstName} autoCapitalize="none" />
          <Button title="Delete my account" variant="danger" onPress={deleteAccount} disabled={confirmText.trim().toLowerCase() !== (me?.firstName ?? '').toLowerCase()} />
        </Card>
        {session?.demo ? <Banner kind="demo" body="Demo controls" actionTitle="Reset the demo (wipe this device)" onAction={resetDemo} /> : null}
      </View>
    </Screen>
  );
}
