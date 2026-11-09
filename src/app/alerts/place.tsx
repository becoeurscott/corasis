import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Banner, Button, Card, Header, Input, ListItem, Screen, toast, Txt } from '@/components/ui';
import { uid } from '@/lib/ids';
import { askPermission } from '@/lib/permissions';
import { backend } from '@/services/backend';
import { useCouple, useMe, usePartner, usePlaces } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const EMOJIS = ['🏠', '💼', '🏋️', '🎓', '☕', '🛒', '👵', '📍'];

/** Add or edit a place: set it from your current location or an address. */
export default function PlaceEditor() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; name?: string; emoji?: string }>();
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const existing = usePlaces().find((p) => p.id === params.id);
  const [name, setName] = useState(existing?.name ?? params.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? params.emoji ?? '📍');
  const [owner, setOwner] = useState(existing?.ownerId ?? partner?.id ?? me?.id ?? '');
  const [alerts, setAlerts] = useState(existing?.alerts ?? true);
  const [coord, setCoord] = useState<{ lat: number; lon: number } | null>(existing ? { lat: existing.lat, lon: existing.lon } : null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  if (!me || !couple) return null;

  const useHere = async () => {
    setBusy(true);
    try {
      if (!(await askPermission('location'))) return;
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return toast('Location permission is off.', 'error');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoord({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch { toast('Could not read your location.', 'error'); } finally { setBusy(false); }
  };
  const findAddress = async () => {
    if (!address.trim()) return;
    setBusy(true);
    try {
      const [hit] = await Location.geocodeAsync(address.trim());
      if (!hit) return toast('Address not found.', 'error');
      setCoord({ lat: hit.latitude, lon: hit.longitude });
    } catch { toast('Address search is unavailable here.', 'error'); } finally { setBusy(false); }
  };
  const save = () => {
    if (!coord || !name.trim()) return;
    backend.savePlace({ id: existing?.id ?? uid('place'), coupleId: couple.id, ownerId: owner, addedBy: existing?.addedBy ?? me.id, name: name.trim(), emoji, lat: coord.lat, lon: coord.lon, radius: existing?.radius ?? 150, alerts });
    router.back();
  };

  return (
    <Screen footer={<Button title="Save" onPress={save} disabled={!coord || !name.trim()} />}>
      <Header title={existing ? existing.name : 'New place'} />
      <View style={{ gap: spacing.md }}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Alex's home" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {EMOJIS.map((e) => (
            <Pressable key={e} accessibilityRole="button" accessibilityState={{ selected: emoji === e }} onPress={() => setEmoji(e)} style={{ padding: 8, borderRadius: 12, backgroundColor: emoji === e ? colors.primarySoft : 'transparent' }}>
              <Txt style={{ fontSize: 30 }}>{e}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Where is it?</Txt>
          <Txt tone="secondary">{coord ? `Set · ${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}` : 'Not set yet'}</Txt>
          <Button title="Use my current location" variant="secondary" icon="location" onPress={useHere} loading={busy} />
          <Input label="Or search an address" value={address} onChangeText={setAddress} onSubmitEditing={findAddress} returnKeyType="search" />
          <Button title="Find address" variant="ghost" size="sm" onPress={findAddress} />
        </Card>
        <Card>
          {partner ? <ListItem title={`${partner.firstName}'s place`} subtitle="Their phone reports arrivals" toggle={owner === partner.id} onToggle={(v) => setOwner(v ? partner.id : me.id)} /> : null}
          <ListItem title="Arrive and leave alerts" toggle={alerts} onToggle={setAlerts} />
        </Card>
        {existing ? <Button title="Delete place" variant="danger" onPress={() => { backend.deletePlace(existing.id); router.back(); }} /> : null}
        <Banner kind="info" body="On Android and in this version of the app, arrivals are noticed while Corasis is open. The iPhone app also checks in the background." />
      </View>
    </Screen>
  );
}
