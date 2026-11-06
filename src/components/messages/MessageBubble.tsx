import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { affectionMeta } from '@/components/home/AffectionRow';
import { MediaThumb } from '@/components/MediaThumb';
import { VoicePlayer } from '@/components/messages/VoicePlayer';
import { Txt } from '@/components/ui';
import { relativeTime } from '@/lib/time';
import type { Message } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function MessageBubble({ msg, mine, onPress }: { msg: Message; mine: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const reactions = Object.values(msg.reactions);
  const status = msg.delivery === 'queued' ? 'Queued · will send when online' : msg.delivery === 'failed' ? 'Failed · tap to retry' : msg.readAt ? 'Read' : 'Sent';
  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${mine ? 'You' : 'Partner'}: ${msg.kind === 'affection' ? affectionMeta[msg.affection!].label : msg.kind === 'voice' ? 'voice note' : msg.text ?? ''}`} onPress={onPress ?? (() => router.push(`/messages/${msg.id}`))} style={[styles.bubble, { backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: mine ? 0 : 1 }]}>
        {msg.kind === 'affection' && msg.affection ? (
          <View style={{ gap: 2 }}>
            <Txt style={{ fontSize: 30, lineHeight: 36 }}>{affectionMeta[msg.affection].emoji}</Txt>
            <Txt variant="bodyStrong" style={{ color: mine ? colors.onPrimary : colors.text }}>
              {affectionMeta[msg.affection].label}
            </Txt>
            {msg.context ? (
              <Txt variant="caption" style={{ color: mine ? colors.onPrimary : colors.textSecondary }}>
                {msg.context}
              </Txt>
            ) : null}
          </View>
        ) : null}
        {msg.media && msg.media.kind !== 'voice' ? <MediaThumb media={msg.media} static style={{ width: 200, aspectRatio: 1, marginBottom: msg.text ? spacing.sm : 0 }} /> : null}
        {msg.text ? <Txt style={{ color: mine ? colors.onPrimary : colors.text }}>{msg.text}</Txt> : null}
      </Pressable>
      {msg.kind === 'voice' && msg.media ? (
        <View style={[styles.bubble, { backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: mine ? 0 : 1 }]}>
          <VoicePlayer uri={msg.media.uri} durationMs={msg.media.durationMs} light={mine} />
        </View>
      ) : null}
      <View style={[styles.meta, mine && { justifyContent: 'flex-end' }]}>
        {reactions.length ? (
          <View style={[styles.reactions, { backgroundColor: colors.surfaceTint }]}>
            <Txt variant="caption">{reactions.join(' ')}</Txt>
          </View>
        ) : null}
        <Txt variant="caption" tone={msg.delivery === 'failed' ? 'danger' : 'muted'}>
          {relativeTime(msg.createdAt)}
          {mine ? ` · ${status}` : ''}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%', gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reactions: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
});
