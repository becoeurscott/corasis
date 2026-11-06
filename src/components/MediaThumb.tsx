import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { Txt } from '@/components/ui';
import type { MediaAsset } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

interface Props {
  media: MediaAsset | null;
  style?: ViewStyle;
  label?: string;
  onPress?: () => void;
  openViewer?: boolean;
  /** Render as a plain View (use inside another pressable). */
  static?: boolean;
}

/** Image/video thumbnail with missing-media fallback and viewer link. */
export function MediaThumb({ media, style, label, onPress, openViewer = true, static: isStatic }: Props) {
  const { colors } = useTheme();
  const open = () => {
    if (onPress) return onPress();
    if (openViewer && media) router.push({ pathname: '/viewer', params: { uri: media.uri, kind: media.kind, caption: label ?? '' } });
  };
  const inner = (
    <>
      {media ? (
        <>
          <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={media.id} accessibilityIgnoresInvertColors />
          {media.kind === 'video' ? (
            <View style={styles.badge}>
              <Txt variant="caption" style={{ color: '#fff' }}>
                ▶ {media.durationMs ? `${Math.round(media.durationMs / 1000)}s` : 'video'}
              </Txt>
            </View>
          ) : null}
          {media.uploadState === 'failed' ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(180,0,0,0.75)' }]}>
              <Txt variant="caption" style={{ color: '#fff' }}>
                Upload failed
              </Txt>
            </View>
          ) : media.uploadState === 'uploading' || media.uploadState === 'pending' ? (
            <View style={styles.badge}>
              <Txt variant="caption" style={{ color: '#fff' }}>
                Uploading…
              </Txt>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.missing}>
          <Txt style={{ fontSize: 22 }}>🖼️</Txt>
          <Txt variant="caption" tone="muted">
            Media unavailable
          </Txt>
        </View>
      )}
    </>
  );
  const boxStyle = [styles.box, { backgroundColor: colors.surfaceTint }, style];
  if (isStatic) return <View accessibilityLabel={label ?? (media ? `${media.kind} thumbnail` : 'Missing media')} style={boxStyle}>{inner}</View>;
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={label ?? (media ? `${media.kind} thumbnail` : 'Missing media')} onPress={open} style={boxStyle}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, overflow: 'hidden', aspectRatio: 3 / 4, width: '100%' },
  badge: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
