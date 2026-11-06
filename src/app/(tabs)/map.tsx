import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { MapCanvas } from '@/components/map/MapCanvas';
import { Banner, Button, Card, EmptyState, ListItem, Screen, SectionTitle, Txt } from '@/components/ui';
import { formatDistance, haversineKm } from '@/lib/geo';
import { refreshMyBattery, refreshMyLocation } from '@/lib/live';
import { describeDifference, formatLocalTime, isStale, relativeTime, zoneDifferenceHours } from '@/lib/time';
import { backend } from '@/services/backend';
import { useCouple, useLive, useMe, useNow, usePartner, useSharing } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';

export default function MapTab() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const now = useNow();
  const mySharing = useSharing(me?.id);
  const theirSharing = useSharing(partner?.id);
  const myLive = useLive(me?.id);
  const theirLive = useLive(partner?.id);
  const unit = usePrefs((s) => s.distanceUnit);
  const setUnit = usePrefs((s) => s.setDistanceUnit);
  const [busy, setBusy] = useState(false);
  const [locState, setLocState] = useState<'idle' | 'denied' | 'unavailable' | 'error'>('idle');

  if (!me) return null;
  if (!couple) {
    return (
      <Screen edges={['top']}>
        <EmptyState emoji="🗺️" title="The map shows both of you" body="Connect with your partner, then choose whether to share location. It is always optional." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
      </Screen>
    );
  }

  const refresh = async () => {
    setBusy(true);
    const r = await refreshMyLocation();
    setLocState(r === 'ok' ? 'idle' : r);
    if (mySharing?.battery) await refreshMyBattery();
    setBusy(false);
  };

  const toggleLocation = async (v: boolean) => {
    await backend.setSharing({ location: v });
    if (v) await refresh();
  };
  const toggleBattery = async (v: boolean) => {
    await backend.setSharing({ battery: v });
    if (v) {
      const ok = await refreshMyBattery();
      if (!ok) setLocState('idle');
    }
  };

  const distanceKm = myLive?.lat != null && myLive.lon != null && theirLive?.lat != null && theirLive.lon != null ? haversineKm(myLive.lat, myLive.lon, theirLive.lat, theirLive.lon) : null;
  const diff = partner ? zoneDifferenceHours(me.timezone, partner.timezone, now) : 0;

  return (
    <Screen edges={['top']}>
      <View style={{ gap: spacing.lg }}>
        <Txt variant="title">Map</Txt>
        <MapCanvas a={{ profile: me, lat: myLive?.lat ?? null, lon: myLive?.lon ?? null, city: myLive?.city ?? null }} b={partner ? { profile: partner, lat: theirLive?.lat ?? null, lon: theirLive?.lon ?? null, city: theirLive?.city ?? null } : { profile: me, lat: null, lon: null, city: null }} />

        <Card style={{ gap: spacing.xs }}>
          {distanceKm != null ? (
            <>
              <Txt variant="display">{formatDistance(distanceKm, unit)}</Txt>
              <Txt tone="secondary">between {myLive?.city ?? 'you'} and {theirLive?.city ?? partner?.firstName}</Txt>
            </>
          ) : (
            <Txt tone="secondary">Distance appears when both of you share location.</Txt>
          )}
          <Txt variant="caption" tone="muted">
            {formatLocalTime(now, me.timezone)} for you · {partner ? `${formatLocalTime(now, partner.timezone)} for ${partner.firstName}` : ''} · {describeDifference(diff)}
          </Txt>
          <Button title={unit === 'km' ? 'Show miles' : 'Show kilometers'} variant="ghost" size="sm" full={false} onPress={() => setUnit(unit === 'km' ? 'mi' : 'km')} />
        </Card>

        <SectionTitle title="Your sharing" />
        <Card>
          <ListItem icon="location" title="Share my location" subtitle="Foreground only: updates when you open the app or tap refresh. Nothing runs in the background." toggle={!!mySharing?.location} onToggle={toggleLocation} />
          <ListItem icon="battery-half" title="Share my battery" subtitle="Sent with each refresh so your partner knows if you might go quiet." toggle={!!mySharing?.battery} onToggle={toggleBattery} />
          {mySharing?.location ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
              <Txt variant="caption" tone="secondary">
                Your last update: {myLive?.locationUpdatedAt ? `${relativeTime(myLive.locationUpdatedAt)}${myLive.accuracyMeters ? ` · ±${Math.round(myLive.accuracyMeters)} m` : ''}` : 'not sent yet'}
              </Txt>
              <Button title="Refresh now" variant="secondary" size="sm" onPress={refresh} loading={busy} />
            </View>
          ) : null}
          {locState === 'denied' ? <Banner kind="warning" title="Location permission is off" body="Enable it in system Settings to share your position. Your partner only sees what you choose to share." /> : null}
          {locState === 'unavailable' ? <Banner kind="info" body="Location is unavailable in this browser context. The mobile build uses the device's GPS." /> : null}
          {locState === 'error' ? <Banner kind="danger" body="Could not read your location right now. Try again in a moment." /> : null}
          {Platform.OS === 'web' && mySharing?.battery ? <Banner kind="info" body="Battery level is not readable in most browsers; it works in the mobile build." /> : null}
        </Card>

        <SectionTitle title={partner ? `${partner.firstName}'s info` : 'Partner'} />
        <Card style={{ gap: spacing.sm }}>
          <Row label="Location" value={theirSharing?.location ? (theirLive?.city ? `${theirLive.city}${theirLive.country ? `, ${theirLive.country}` : ''}` : theirLive?.lat != null ? `${theirLive.lat.toFixed(2)}, ${theirLive.lon?.toFixed(2)}` : 'Shared, no fix yet') : 'Paused by partner'} sub={theirLive?.locationUpdatedAt ? `${relativeTime(theirLive.locationUpdatedAt)}${theirLive.accuracyMeters ? ` · ±${Math.round(theirLive.accuracyMeters)} m` : ''}${isStale(theirLive.locationUpdatedAt, 60) ? ' · may be out of date' : ''}` : undefined} />
          <Row label="Battery" value={theirSharing?.battery ? (theirLive?.batteryPercent != null ? `${theirLive.batteryPercent}%` : 'Shared, not reported yet') : 'Not shared'} sub={theirLive?.batteryUpdatedAt ? `${relativeTime(theirLive.batteryUpdatedAt)}${isStale(theirLive.batteryUpdatedAt, 60) ? ' · may be out of date' : ''}` : undefined} />
          <Row label="Local time" value={partner ? `${formatLocalTime(now, partner.timezone)} · ${partner.timezone.replace(/_/g, ' ')}` : '—'} />
          <Txt variant="caption" tone="muted">
            Each person controls their own sharing. Location history is never stored.
          </Txt>
        </Card>
      </View>
    </Screen>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
      {sub ? (
        <Txt variant="caption" tone="secondary">
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}
