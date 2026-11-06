import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoPlayer } from '@/components/VideoPlayer';
import { Txt } from '@/components/ui';

/** Fullscreen media viewer for photos and videos. */
export default function Viewer() {
  const { uri, kind, caption } = useLocalSearchParams<{ uri: string; kind: string; caption?: string }>();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {kind === 'video' ? <VideoPlayer uri={uri} /> : <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors />}
      <Pressable accessibilityRole="button" accessibilityLabel="Close viewer" onPress={() => router.back()} style={[styles.close, { top: insets.top + 12 }]}>
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
      {caption ? (
        <View style={[styles.caption, { paddingBottom: insets.bottom + 16 }]}>
          <Txt style={{ color: '#fff' }} center>
            {caption}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
});
