import { MotionPressable } from '@/components/ui/MotionPressable';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export function VoicePlayer({ uri, durationMs, light }: { uri: string; durationMs?: number; light?: boolean }) {
  const { colors } = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const fg = light ? colors.onPrimary : colors.text;
  const total = status.duration ? status.duration : (durationMs ?? 0) / 1000;
  const pct = total ? Math.min(1, status.currentTime / total) : 0;
  const toggle = () => {
    try {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || (total && status.currentTime >= total - 0.05)) player.seekTo(0);
        player.play();
      }
    } catch {
      /* playback unavailable */
    }
  };
  return (
    <View style={styles.row}>
      <MotionPressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'} onPress={toggle} style={[styles.btn, { backgroundColor: light ? 'rgba(255,255,255,0.25)' : colors.primarySoft }]}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={light ? colors.onPrimary : colors.primaryStrong} />
      </MotionPressable>
      <View style={[styles.track, { backgroundColor: light ? 'rgba(255,255,255,0.35)' : colors.border }]}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: light ? colors.onPrimary : colors.primary, borderRadius: 2 }} />
      </View>
      <Txt variant="caption" style={{ color: fg, minWidth: 34 }}>
        {Math.round(total)}s
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
});
