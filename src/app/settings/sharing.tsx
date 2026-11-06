import React from 'react';
import { View } from 'react-native';

import { Banner, Card, Divider, Header, ListItem, Screen, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, useMe, useSharing } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function SharingSettings() {
  const me = useMe();
  const couple = useCouple();
  const sharing = useSharing(me?.id);
  return (
    <Screen>
      <Header title="Location & battery" />
      <View style={{ gap: spacing.lg }}>
        <Card>
          <ListItem icon="location" title="Share my location" subtitle="Foreground only, no history. Pausing clears your position for your partner right away." toggle={!!sharing?.location} onToggle={(v) => backend.setSharing({ location: v })} disabled={!couple} />
          <Divider />
          <ListItem icon="battery-half" title="Share my battery" subtitle="Sent when the app refreshes" toggle={!!sharing?.battery} onToggle={(v) => backend.setSharing({ battery: v })} disabled={!couple} />
        </Card>
        {!couple ? <Banner kind="info" body="Sharing applies once you are connected with a partner." /> : null}
        <Txt variant="caption" tone="muted">
          What we do not do: track you in the background, store a location history, or share anything you have not switched on. Your partner sees the city, approximate accuracy and when it was last updated.
        </Txt>
      </View>
    </Screen>
  );
}
