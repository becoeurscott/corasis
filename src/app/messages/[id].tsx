import { MotionPressable } from '@/components/ui/MotionPressable';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { affectionMeta } from '@/components/home/AffectionRow';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { Button, Card, EmptyState, Header, Screen, toast, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { uid } from '@/lib/ids';
import { backend, useData } from '@/services/backend';
import { useMe, useMessages } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const quickReplies = ['❤️ Love this', 'Call me when you can', 'Miss you', 'On it!'];
const emojis = ['❤️', '😂', '🥹', '😘', '🔥'];

export default function MessageDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const msg = useMessages().find((m) => m.id === id);
  const profiles = useData((s) => s.profiles);
  if (!me || !msg) {
    return (
      <Screen>
        <Header title="Message" />
        <EmptyState emoji="🫥" title="Message not found" />
      </Screen>
    );
  }
  const mine = msg.senderId === me.id;
  const sender = profiles[msg.senderId];
  const reply = async (text: string) => {
    try {
      await backend.sendMessage({ kind: 'text', text, clientRequestId: uid('req') });
      haptic('success');
      toast('Sent', 'success');
      router.back();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const retry = async () => {
    await backend.markDelivery(msg.id, 'sent');
    toast('Resent', 'success');
  };
  return (
    <Screen>
      <Header title={mine ? 'Your message' : `From ${sender?.firstName ?? 'partner'}`} />
      <View style={{ gap: spacing.lg }}>
        <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
          <MessageBubble msg={msg} mine={mine} onPress={() => {}} />
        </View>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="caption" tone="secondary" weight="600">
            Details
          </Txt>
          <Txt variant="caption">
            Sent {new Date(msg.createdAt).toLocaleString()} · {msg.delivery === 'failed' ? 'Delivery failed' : msg.delivery === 'queued' ? 'Queued' : 'Delivered to server'}
            {msg.readAt ? ` · Read ${new Date(msg.readAt).toLocaleTimeString()}` : ''}
          </Txt>
          {msg.kind === 'affection' && msg.affection ? <Txt variant="caption" tone="muted">{affectionMeta[msg.affection].label}{msg.context ? ` · "${msg.context}"` : ''}</Txt> : null}
          {msg.delivery === 'failed' && mine ? <Button title="Retry" variant="secondary" size="sm" onPress={retry} /> : null}
        </Card>
        {!mine ? (
          <>
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="caption" tone="secondary" weight="600">
                React
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {emojis.map((e) => (
                  <MotionPressable key={e} accessibilityRole="button" accessibilityLabel={`React ${e}`} onPress={() => { haptic('selection'); backend.reactToMessage(msg.id, e); }} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: msg.reactions[me.id] === e ? colors.primarySoft : colors.surfaceTint }}>
                    <Txt style={{ fontSize: 22 }}>{e}</Txt>
                  </MotionPressable>
                ))}
              </View>
            </Card>
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="caption" tone="secondary" weight="600">
                Quick reply
              </Txt>
              {quickReplies.map((q) => (
                <Button key={q} title={q} variant="secondary" onPress={() => reply(q)} />
              ))}
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
