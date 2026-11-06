import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';

/**
 * Video playback. On web we use the native <video> element; on native the
 * mobile build should swap in `expo-video` (VideoView) — kept out of this
 * preview build to avoid an extra native module in Expo Go.
 */
export function VideoPlayer({ uri }: { uri: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('video', { src: uri, controls: true, autoPlay: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' } });
  }
  return (
    <View style={styles.fallback}>
      <Txt style={{ color: '#fff', fontSize: 40 }}>▶</Txt>
      <Txt style={{ color: '#fff' }} center>
        Video playback uses expo-video in the mobile build.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({ fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 } });
