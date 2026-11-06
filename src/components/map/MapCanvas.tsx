import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Txt } from '@/components/ui';
import type { Profile } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

interface Point {
  profile: Profile;
  lat: number | null;
  lon: number | null;
  city: string | null;
}

/**
 * Schematic map: an equirectangular projection with a soft grid, two markers
 * and a connecting line. It has no tile provider dependency, so it renders in
 * the browser preview and in Expo Go. The mobile build can swap in
 * react-native-maps behind the same props (see docs/NATIVE.md).
 */
export function MapCanvas({ a, b, height = 300 }: { a: Point; b: Point; height?: number }) {
  const { colors } = useTheme();
  const [size, setSize] = React.useState({ w: 0, h: height });
  const pts = [a, b].filter((p) => p.lat != null && p.lon != null) as (Point & { lat: number; lon: number })[];

  // Fit both points with padding; fall back to world view.
  let minLat = -60, maxLat = 75, minLon = -170, maxLon = 170;
  if (pts.length) {
    const lats = pts.map((p) => p.lat);
    const lons = pts.map((p) => p.lon);
    const padLat = Math.max(6, (Math.max(...lats) - Math.min(...lats)) * 0.6);
    const padLon = Math.max(10, (Math.max(...lons) - Math.min(...lons)) * 0.4);
    minLat = Math.min(...lats) - padLat;
    maxLat = Math.max(...lats) + padLat;
    minLon = Math.min(...lons) - padLon;
    maxLon = Math.max(...lons) + padLon;
  }
  const project = (lat: number, lon: number) => ({ x: ((lon - minLon) / (maxLon - minLon)) * size.w, y: ((maxLat - lat) / (maxLat - minLat)) * size.h });
  const projected = pts.map((p) => ({ ...p, ...project(p.lat, p.lon) }));
  const line = projected.length === 2 ? projected : null;
  const dx = line ? line[1].x - line[0].x : 0;
  const dy = line ? line[1].y - line[0].y : 0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View accessibilityLabel="Schematic map of both partners" onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: height })} style={[styles.canvas, { height, backgroundColor: colors.surfaceTint, borderColor: colors.border }]}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={`h${i}`} style={[styles.hline, { top: (i / 6) * height, backgroundColor: colors.border }]} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={`v${i}`} style={[styles.vline, { left: (i / 8) * size.w, backgroundColor: colors.border }]} />
      ))}
      {line && size.w > 0 ? <View style={{ position: 'absolute', left: line[0].x, top: line[0].y, width: len, height: 2, backgroundColor: colors.primary, opacity: 0.6, transform: [{ translateY: -1 }, { rotate: `${angle}deg` }], transformOrigin: 'left center' } as never} /> : null}
      {size.w > 0 && projected.map((p) => (
        <View key={p.profile.id} style={{ position: 'absolute', left: p.x - 80, top: p.y - 24, alignItems: 'center', width: 160 }}>
          <View style={[styles.pin, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
            <Avatar name={p.profile.firstName} uri={p.profile.avatarUri} size={36} simulated={p.profile.isSimulated} />
          </View>
          <View style={[styles.labelBox, { backgroundColor: colors.surface }]}>
            <Txt variant="caption" weight="600" numberOfLines={1}>
              {p.city ?? p.profile.firstName}
            </Txt>
          </View>
        </View>
      ))}
      {!pts.length ? (
        <View style={styles.center}>
          <Txt variant="caption" tone="muted" center>
            Markers appear when location sharing is on.
          </Txt>
        </View>
      ) : null}
      <View style={[styles.note, { backgroundColor: colors.surface }]}>
        <Txt variant="caption" tone="muted">
          Schematic map · real map tiles need a development build
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1 },
  hline: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.6 },
  vline: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.6 },
  pin: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  labelBox: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, maxWidth: 160 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  note: { position: 'absolute', bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
