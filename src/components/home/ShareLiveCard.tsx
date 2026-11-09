import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Txt } from '@/components/ui';
import { backend, useData } from '@/services/backend';
import { useSession } from '@/store/hooks';
import { askPermission } from '@/lib/permissions';

const KEY = 'share-live-asked';

/** One-time ask on Home: share location (flag + distance) and battery with the partner. */
export function ShareLiveCard({ partnerName }: { partnerName: string }) {
  const session = useSession();
  const mine = useData((s) => (session ? s.sharing[session.userId] : undefined));
  const [asked, setAsked] = useState(true);
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => setAsked(v === '1')).catch(() => setAsked(false)); }, []);
  if (asked || !backend.isRemoteSession() || mine?.location || mine?.battery) return null;
  const close = () => { setAsked(true); AsyncStorage.setItem(KEY, '1').catch(() => undefined); };
  const share = async () => {
    close();
    if (await askPermission('location')) await Location.requestForegroundPermissionsAsync().catch(() => undefined);
    await backend.setSharing({ location: true, battery: true });
  };
  return (
    <Card style={{ gap: 10 }}>
      <Txt variant="heading">Share with {partnerName}?</Txt>
      <Txt tone="secondary">They’ll see your country flag, how far apart you are, and your battery. You can change this anytime in Map.</Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button title="Not now" variant="ghost" onPress={close} />
        <Button title="Share" onPress={share} />
      </View>
    </Card>
  );
}
