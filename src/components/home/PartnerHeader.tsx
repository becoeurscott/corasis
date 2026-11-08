import { MotionPressable } from '@/components/ui/MotionPressable';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Avatar, Txt } from '@/components/ui';
import { formatDistance, haversineKm } from '@/lib/geo';
import { describeDifference, formatLocalTime, zoneDifferenceHours } from '@/lib/time';
import { useData, type Profile } from '@/services/backend';
import { useCouple, useLive, useNow } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { BatteryGauge } from './BatteryGauge';
import { DottedConnector } from './DottedConnector';

const AVATAR = 64;
const HEART_GAP = 52;

export function PartnerHeader({ me, partner }: { me: Profile; partner: Profile | null }) {
  const { colors } = useTheme();
  const now = useNow(15_000);
  const diff = partner ? zoneDifferenceHours(me.timezone, partner.timezone, now) : 0;
  const [rowWidth, setRowWidth] = useState(0);
  const couple = useCouple();
  // Days since the couple's start date, when it's known.
  const daysTogether = partner && couple?.relationshipStart ? Math.floor((Date.parse(todayKeyLocal(now)) - Date.parse(couple.relationshipStart)) / 86_400_000) : null;
  // Your own info is always visible to you; your partner's only when they share it.
  const myInfo = useData((s) => s.live[me.id]);
  const theirLive = useLive(partner?.id);
  const myBattery = useDeviceBattery();
  const myCountry = useMyCountry();
  const unit = usePrefs((s) => s.distanceUnit);
  // Distance: your position from this phone; your partner's only when they share location.
  const myLat = myCountry?.lat ?? myInfo?.lat ?? null;
  const myLon = myCountry?.lon ?? myInfo?.lon ?? null;
  const distanceKm = myLat != null && myLon != null && theirLive?.lat != null && theirLive.lon != null ? haversineKm(myLat, myLon, theirLive.lat, theirLive.lon) : null;
  // Each person column is (row - middle - gaps) / 2 wide; the line runs between the avatar edges.
  const columnWidth = (rowWidth - 2 * spacing.sm - 96) / 2;
  const lineWidth = Math.max(0, rowWidth - 2 * (columnWidth / 2 + AVATAR / 2 + 6));
  return (
    <View style={styles.row} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      {partner && rowWidth > 0 ? (
        <View pointerEvents="none" style={[styles.line, { left: (rowWidth - lineWidth) / 2, width: lineWidth }]}>
          {/* Both halves flow from each profile toward the heart. */}
          <DottedConnector width={Math.max(0, (lineWidth - HEART_GAP) / 2)} />
          <View style={{ width: HEART_GAP }} />
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <DottedConnector width={Math.max(0, (lineWidth - HEART_GAP) / 2)} />
          </View>
        </View>
      ) : null}
      <Person profile={me} now={now} label="You" country={myCountry ?? (myInfo?.countryCode ? { code: myInfo.countryCode, name: myInfo.country ?? myInfo.countryCode } : null)} battery={myBattery?.level ?? myInfo?.batteryPercent ?? null} charging={myBattery?.charging} />
      <View style={[styles.middle, daysTogether != null && daysTogether >= 0 ? { paddingTop: 0 } : null]}>
        {daysTogether != null && daysTogether >= 0 ? (
          <Txt variant="caption" tone="primary" weight="700" center accessibilityLabel={`Together for ${daysTogether} days`}>
            {daysTogether === 1 ? '1 day' : `${daysTogether.toLocaleString()} days`}
          </Txt>
        ) : null}
        <View style={[styles.heart, { backgroundColor: colors.primarySoft }]}>
          <Txt style={{ fontSize: 18 }}>{partner ? '💞' : '🔗'}</Txt>
        </View>
        {partner ? (
          <Txt variant="caption" tone="muted" center>
            {describeDifference(diff)}
          </Txt>
        ) : null}
        {distanceKm != null ? (
          <Txt variant="caption" tone="secondary" center accessibilityLabel={`${formatDistance(distanceKm, unit)} apart`}>
            📍 {formatDistance(distanceKm, unit)}
          </Txt>
        ) : null}
      </View>
      {partner ? (
        <Person profile={partner} now={now} label={partner.isSimulated ? null : 'Partner'} country={theirLive?.countryCode ? { code: theirLive.countryCode, name: theirLive.country ?? theirLive.countryCode } : null} battery={theirLive?.batteryPercent ?? null} />
      ) : (
        <MotionPressable accessibilityRole="button" onPress={() => router.push('/settings/partner')} style={styles.person}>
          <View style={[styles.invite, { borderColor: colors.primary }]}>
            <Txt style={{ fontSize: 22 }}>＋</Txt>
          </View>
          <Txt variant="bodyStrong" tone="primary" center>
            Invite partner
          </Txt>
        </MotionPressable>
      )}
    </View>
  );
}

/** This phone's battery, updated live as it drains or charges. null where unavailable (web, simulator). */
function useDeviceBattery(): { level: number; charging: boolean } | null {
  const [state, setState] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    const subs: { remove(): void }[] = [];
    (async () => {
      try {
        if (!(await Battery.isAvailableAsync())) return;
        const [level, bs] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
        if (!alive || level < 0) return;
        const isCharging = (s: Battery.BatteryState) => s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL;
        setState({ level: Math.round(level * 100), charging: isCharging(bs) });
        subs.push(Battery.addBatteryLevelListener(({ batteryLevel }) => batteryLevel >= 0 && setState((s) => ({ level: Math.round(batteryLevel * 100), charging: s?.charging ?? false }))));
        subs.push(Battery.addBatteryStateListener(({ batteryState }) => setState((s) => (s ? { ...s, charging: isCharging(batteryState) } : s))));
      } catch {
        /* battery optional */
      }
    })();
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
    };
  }, []);
  return state;
}

/** Local calendar day as YYYY-MM-DD. */
function todayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "FR" → 🇫🇷 */
export function flagEmoji(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

type Here = { code: string; name: string; lat: number; lon: number };
let cachedCountry: Here | null = null;
/** Country (ISO code + name) from the phone's current location; asks for "while using" permission once. */
function useMyCountry(): Here | null {
  const [country, setCountry] = useState(cachedCountry);
  useEffect(() => {
    if (Platform.OS === 'web' || cachedCountry) return;
    let alive = true;
    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        if (!pos) return;
        const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        if (place?.isoCountryCode) {
          cachedCountry = { code: place.isoCountryCode, name: place.country ?? place.isoCountryCode, lat: pos.coords.latitude, lon: pos.coords.longitude };
          if (alive) setCountry(cachedCountry);
        }
      } catch {
        /* location optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return country;
}

function Person({ profile, now, label, country, battery, charging }: { profile: Profile; now: Date; label: string | null; country: { code: string; name: string } | null; battery: number | null; charging?: boolean }) {
  return (
    <View style={styles.person}>
      <Avatar name={profile.firstName} uri={profile.avatarUri} size={AVATAR} simulated={profile.isSimulated} />
      <Txt variant="bodyStrong" center numberOfLines={1}>
        {profile.firstName}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {country && flagEmoji(country.code) ? (
          <Txt style={{ fontSize: 15, lineHeight: 18 }} accessibilityLabel={country.name}>
            {flagEmoji(country.code)}
          </Txt>
        ) : null}
        <Txt variant="caption" tone="secondary">
          {formatLocalTime(now, profile.timezone)}
          {label ? ` · ${label}` : ''}
        </Txt>
      </View>
      {battery != null ? <BatteryGauge percent={battery} charging={charging} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  line: { position: 'absolute', top: AVATAR / 2 - 2, flexDirection: 'row' },
  person: { flex: 1, alignItems: 'center', gap: 4 },
  middle: { width: 96, alignItems: 'center', gap: 4, paddingTop: AVATAR / 2 - 22 },
  heart: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  invite: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
