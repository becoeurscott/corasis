import { Image } from 'expo-image';
import { requestPermissionsAsync as requestMediaPermissions, saveToLibraryAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Banner, Button, Card, Chip, Gradient, Header, Input, ListItem, Screen, toast, Txt } from '@/components/ui';
import { diffDays, formatDate, todayKey } from '@/lib/time';
import { pickFromLibrary } from '@/lib/media';
import { useCouple, useMe, useMemories, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Style = 'gradient' | 'photo' | 'minimal';

/** Wallpaper editor with home/lock previews and export to Photos or the share sheet. */
export default function WallpaperEditor() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const memories = useMemories();
  const firstPhoto = memories.find((m) => m.media && m.media.kind === 'photo')?.media?.uri ?? null;
  const [photo, setPhoto] = useState<string | null>(firstPhoto);
  const [style, setStyle] = useState<Style>('photo');
  const [showNames, setShowNames] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [quote, setQuote] = useState('');
  const [preview, setPreview] = useState<'home' | 'lock'>('lock');
  const [busy, setBusy] = useState(false);
  const ref = useRef<React.ElementRef<typeof View>>(null);

  const start = couple?.relationshipStart ?? null;
  const days = start ? diffDays(start, todayKey(couple?.coupleTimezone ?? 'UTC')) : null;

  const exportImage = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
      if (Platform.OS === 'web') {
        const a = (globalThis as unknown as { document?: Document }).document?.createElement('a');
        if (a) {
          a.href = uri;
          a.download = 'together-wallpaper.png';
          a.click();
        }
        toast('Wallpaper downloaded', 'success');
      } else {
        const perm = await requestMediaPermissions();
        if (perm.granted) {
          await saveToLibraryAsync(uri);
          toast('Saved to Photos. Set it as wallpaper from the Photos app.', 'success');
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else toast('Could not save: photo library permission is off.', 'error');
      }
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const textColor = '#fff';
  return (
    <Screen footer={<Button title={busy ? 'Exporting…' : Platform.OS === 'web' ? 'Download image' : 'Save to Photos'} size="lg" onPress={exportImage} loading={busy} />}>
      <Header title="Wallpaper" />
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Lock screen" selected={preview === 'lock'} onPress={() => setPreview('lock')} small />
          <Chip label="Home screen" selected={preview === 'home'} onPress={() => setPreview('home')} small />
        </View>
        <View style={{ alignItems: 'center' }}>
          <View ref={ref} collapsable={false} style={[styles.phone, { backgroundColor: colors.gradientEnd }]}>
            {style === 'photo' && photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
            {style === 'gradient' ? <Gradient style={StyleSheet.absoluteFill} /> : null}
            {style === 'minimal' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} /> : null}
            {style === 'photo' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} /> : null}
            {preview === 'lock' ? (
              <View style={styles.clock}>
                <Txt style={{ color: style === 'minimal' ? colors.text : textColor, fontSize: 14 }}>{formatDate(todayKey('UTC'), { weekday: 'long', month: 'long', day: 'numeric' })}</Txt>
                <Txt style={{ color: style === 'minimal' ? colors.text : textColor, fontSize: 56, fontWeight: '300', lineHeight: 62 }}>09:41</Txt>
              </View>
            ) : (
              <View style={styles.apps}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} style={[styles.app, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                ))}
              </View>
            )}
            <View style={[styles.textBlock, { backgroundColor: style === 'minimal' ? colors.surfaceTint : 'rgba(0,0,0,0.35)' }]}>
              {showNames ? (
                <Txt variant="heading" style={{ color: style === 'minimal' ? colors.text : textColor }}>
                  {me?.firstName ?? 'You'} & {partner?.firstName ?? 'Partner'}
                </Txt>
              ) : null}
              {showDate && days != null ? (
                <Txt variant="caption" style={{ color: style === 'minimal' ? colors.textSecondary : 'rgba(255,255,255,0.9)' }}>
                  {days} days together · since {formatDate(start!, { month: 'short', year: 'numeric' })}
                </Txt>
              ) : null}
              {quote ? (
                <Txt variant="caption" style={{ color: style === 'minimal' ? colors.textSecondary : 'rgba(255,255,255,0.9)', fontStyle: 'italic' }}>
                  “{quote}”
                </Txt>
              ) : null}
            </View>
          </View>
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Txt variant="caption" tone="secondary" weight="600">
            Style
          </Txt>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Photo" selected={style === 'photo'} onPress={() => setStyle('photo')} small />
            <Chip label="Gradient" selected={style === 'gradient'} onPress={() => setStyle('gradient')} small />
            <Chip label="Minimal" selected={style === 'minimal'} onPress={() => setStyle('minimal')} small />
          </View>
          {style === 'photo' ? <Button title={photo ? 'Change photo' : 'Choose a couple photo'} variant="secondary" size="sm" onPress={async () => { const r = await pickFromLibrary(); if (r && 'error' in r) toast(r.error, 'error'); else if (r) setPhoto(r.asset.uri); }} /> : null}
          <ListItem title="Show names" toggle={showNames} onToggle={setShowNames} />
          <ListItem title="Show relationship date" toggle={showDate} onToggle={setShowDate} disabled={!start} subtitle={start ? undefined : 'Add a start date in Couple details'} />
          <Input label="Quote (optional)" value={quote} onChangeText={setQuote} maxLength={80} placeholder="Something only you two get" />
        </Card>
        <Banner kind="info" body={Platform.OS === 'ios' ? 'iOS does not let apps set the wallpaper directly. We save the image to Photos; then choose it from Settings → Wallpaper.' : Platform.OS === 'android' ? 'On Android the image is saved to your gallery; set it as wallpaper from there. Direct wallpaper setting is a possible native add-on.' : 'The browser downloads a PNG. On a phone the image is saved to the photo library.'} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  phone: { width: 240, height: 500, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end' },
  clock: { position: 'absolute', top: 44, left: 0, right: 0, alignItems: 'center' },
  apps: { position: 'absolute', top: 36, left: 20, right: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  app: { width: 38, height: 38, borderRadius: 10 },
  textBlock: { margin: 16, padding: 12, borderRadius: 14, gap: 4 },
});
