import React, { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Card, Header, ListItem, Screen, toast, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useEntitlements } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

/**
 * Optional monetization behind a flag. No billing provider is configured, so
 * this is a clearly labeled demo: no prices, no trials, no fake receipts.
 */
export const PREMIUM_ENABLED = true;

export default function PremiumSettings() {
  const ent = useEntitlements();
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');

  const purchase = async (fail = false) => {
    setState('loading');
    await new Promise((r) => setTimeout(r, 900));
    if (fail) {
      setState('failed');
      return;
    }
    await backend.setDemoPremium(true);
    setState('idle');
    toast('Together Plus enabled (demo entitlement)', 'success');
  };

  return (
    <Screen>
      <Header title="Together Plus" />
      <View style={{ gap: spacing.lg }}>
        <Banner kind="demo" title="Billing is not configured" body="No store products or prices are loaded, so nothing can be charged. Toggling Plus here grants a local demo entitlement only. With RevenueCat or StoreKit/Play Billing configured, this screen shows the verified price and renewal terms from the store." />
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">What Plus adds</Txt>
          <ListItem emoji="🧭" title="Future plans deck" chevron={false} />
          <ListItem emoji="🪢" title="Communication and repair deck" chevron={false} />
          <ListItem emoji="🎨" title="Extra wallpaper styles (coming)" chevron={false} />
          <Txt variant="caption" tone="muted">
            Everything else in Together stays free.
          </Txt>
        </Card>
        {ent.premium ? (
          <>
            <Banner kind="success" body={`Plus is active (source: ${ent.source}).`} />
            <Button title="Manage subscription" variant="secondary" onPress={() => toast('Store management opens here once billing is configured.')} />
            <Button title="Remove demo entitlement" variant="ghost" onPress={() => backend.setDemoPremium(false)} />
          </>
        ) : (
          <>
            <Button title={state === 'loading' ? 'Processing…' : 'Enable Plus (demo)'} onPress={() => purchase(false)} loading={state === 'loading'} />
            <Button title="Simulate a failed purchase" variant="ghost" onPress={() => purchase(true)} />
            <Button title="Restore purchases" variant="ghost" onPress={() => toast('Nothing to restore: no store account is linked in the demo.')} />
            {state === 'failed' ? <Banner kind="danger" title="Purchase did not complete" body="You were not charged. Try again or restore an existing purchase." /> : null}
          </>
        )}
      </View>
    </Screen>
  );
}
