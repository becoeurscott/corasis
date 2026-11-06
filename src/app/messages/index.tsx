import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AffectionRow } from '@/components/home/AffectionRow';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { VoiceRecorder } from '@/components/messages/VoiceRecorder';
import { Banner, Button, EmptyState, Header, Input, Screen, Sheet, toast, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { uid } from '@/lib/ids';
import { pickFromLibrary, uploadAsset } from '@/lib/media';
import { backend, MediaAsset } from '@/services/backend';
import { useCouple, useMe, useMessages, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Conversation history + composer (text, photo, voice, quick affection). */
export default function MessagesScreen() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const messages = useMessages();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<MediaAsset | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    backend.markRead().catch(() => {});
  }, [messages.length]);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const send = async (input: { kind: 'text' | 'voice'; text?: string; media?: MediaAsset | null }) => {
    if (!couple) return toast('Connect with your partner first.', 'error');
    setBusy(true);
    const requestId = uid('req');
    try {
      let media = input.media ?? null;
      if (media) media = await uploadAsset(media, () => {});
      await backend.sendMessage({ kind: input.kind, text: input.text?.trim() || null, media, clientRequestId: requestId });
      haptic('success');
      setText('');
      setPhoto(null);
      setVoiceOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!me) return null;

  return (
    <Screen scroll={false} padded={false} footer={
      <View style={{ gap: spacing.sm }}>
        <AffectionRow disabled={!couple} />
        {photo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Txt variant="caption" tone="secondary">
              📎 Photo attached
            </Txt>
            <Button title="Remove" variant="ghost" size="sm" full={false} onPress={() => setPhoto(null)} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input value={text} onChangeText={setText} placeholder={couple ? `Message ${partner?.firstName ?? ''}` : 'Connect to send messages'} editable={!!couple} maxLength={500} onSubmitEditing={() => text.trim() && send({ kind: 'text', text, media: photo })} returnKeyType="send" />
          </View>
          <Button title="📷" variant="secondary" full={false} size="sm" onPress={async () => { const r = await pickFromLibrary(); if (r && 'error' in r) toast(r.error, 'error'); else if (r) setPhoto(r.asset); }} accessibilityHint="Attach a photo" />
          <Button title="🎤" variant="secondary" full={false} size="sm" onPress={() => setVoiceOpen(true)} accessibilityHint="Record a voice note" />
          <Button title="Send" full={false} size="sm" loading={busy} disabled={!couple || (!text.trim() && !photo)} onPress={() => send({ kind: 'text', text, media: photo })} />
        </View>
      </View>
    }>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title={partner ? partner.firstName : 'Messages'} subtitle={partner?.isSimulated ? 'Simulated partner · replies are generated locally' : undefined} />
      </View>
      {!couple ? <View style={{ paddingHorizontal: spacing.lg }}><Banner kind="info" body="Messages need a connected partner." actionTitle="Invite" onAction={() => router.push('/settings/partner')} /></View> : null}
      {data.length ? (
        <FlatList
          ref={listRef}
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MessageBubble msg={item} mine={item.senderId === me.id} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      ) : (
        <EmptyState emoji="💌" title="No messages yet" body="Send a kiss, a note or a voice message to start." />
      )}
      <Sheet visible={voiceOpen} onClose={() => setVoiceOpen(false)} title="Voice note">
        <VoiceRecorder onSend={(asset) => send({ kind: 'voice', media: asset })} onCancel={() => setVoiceOpen(false)} />
      </Sheet>
      <View style={{ height: 1, backgroundColor: colors.border }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md } });
