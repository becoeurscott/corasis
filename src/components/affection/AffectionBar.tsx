import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, View } from 'react-native';

import { toast, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { AFFECTION_EMOJIS, useAffection } from '@/store/affection';
import { useTheme } from '@/theme/ThemeProvider';

/** Row of emojis under the partner header: one tap sends it to your partner. */
export function AffectionBar({ partnerName }: { partnerName: string }) {
  const { colors } = useTheme();
  const show = useAffection((s) => s.show);
  const send = async (emoji: string) => {
    show(emoji);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const { simulatedReply } = await backend.sendAffection(emoji);
      if (simulatedReply) setTimeout(() => show(emoji), 3000);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="caption" tone="primary" weight="700" style={{ letterSpacing: 1.5 }}>SEND AFFECTION</Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {AFFECTION_EMOJIS.map((emoji) => (
          <Pressable key={emoji} onPress={() => send(emoji)} accessibilityRole="button" accessibilityLabel={`Send ${emoji} to ${partnerName}`}
            style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, transform: [{ scale: pressed ? 0.88 : 1 }] })}>
            <Txt style={{ fontSize: 28, lineHeight: 34 }}>{emoji}</Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
