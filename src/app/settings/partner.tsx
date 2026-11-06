import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { InvitePanel } from '@/components/InvitePanel';
import { Avatar, Banner, Button, Card, Header, Screen, toast, Txt, useConfirm } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, usePartner } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function PartnerConnection() {
  const couple = useCouple();
  const partner = usePartner();
  const ask = useConfirm((s) => s.ask);

  const unlink = async () => {
    const ok = await ask({ title: `Unlink from ${partner?.firstName ?? 'your partner'}?`, body: 'Both of you lose access to the shared album, answers, messages and calendar immediately. Each of you keeps your own account. On a server build, shared content stays exportable for 30 days before deletion. This cannot be undone from the app.', confirmTitle: 'Unlink', destructive: true });
    if (!ok) return;
    await backend.unlink();
    toast('Unlinked. Your account is still here.');
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <Header title="Partner connection" />
      <View style={{ gap: spacing.lg }}>
        {couple && partner ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar name={partner.firstName} uri={partner.avatarUri} size={56} simulated={partner.isSimulated} />
              <View style={{ flex: 1 }}>
                <Txt variant="heading">Connected with {partner.firstName}</Txt>
                <Txt variant="caption" tone="secondary">
                  Since {new Date(couple.createdAt).toLocaleDateString()}{partner.isSimulated ? ' · simulated partner' : ''}
                </Txt>
              </View>
            </Card>
            <Banner kind="info" body="A couple has exactly two members. To connect with someone else, unlink first." />
            <Button title="Unlink partner" variant="danger" onPress={unlink} />
          </>
        ) : (
          <InvitePanel onPaired={() => router.replace('/(tabs)')} />
        )}
      </View>
    </Screen>
  );
}
