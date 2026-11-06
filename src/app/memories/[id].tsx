import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { MediaThumb } from '@/components/MediaThumb';
import { VoicePlayer } from '@/components/messages/VoicePlayer';
import { Avatar, Banner, Button, Card, EmptyState, Header, Input, Screen, toast, Txt, useConfirm } from '@/components/ui';
import { uid } from '@/lib/ids';
import { formatDate } from '@/lib/time';
import { backend, useData } from '@/services/backend';
import { useMe, useMemories, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function MemoryDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const partner = usePartner();
  const mem = useMemories().find((m) => m.id === id);
  const profiles = useData((s) => s.profiles);
  const ask = useConfirm((s) => s.ask);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(mem?.caption ?? '');
  const [title, setTitle] = useState(mem?.title ?? '');
  const [body, setBody] = useState(mem?.body ?? '');

  if (!me || !mem) {
    return (
      <Screen>
        <Header title="Memory" />
        <EmptyState emoji="🫥" title="Memory not found" body="It may have been deleted by its owner." />
      </Screen>
    );
  }
  const owner = profiles[mem.ownerId];
  const isOwner = mem.ownerId === me.id;
  const fav = mem.favoritedBy.includes(me.id);

  const remove = async () => {
    const ok = await ask({ title: 'Delete this memory?', body: mem.kind === 'moment' ? 'This also removes the daily moment. If it was the only one that day, that day no longer counts toward the flame. Your partner keeps their own moment.' : 'This removes it from the shared album for both of you. This cannot be undone.', confirmTitle: 'Delete', destructive: true });
    if (!ok) return;
    await backend.deleteMemory(mem.id);
    toast('Deleted');
    router.back();
  };

  const reshare = async () => {
    await backend.sendMessage({ kind: 'text', text: `Remember this? ${formatDate(mem.takenOn)}${mem.caption ? ` — ${mem.caption}` : ''}`, media: mem.media, clientRequestId: uid('req') });
    toast(`Shared with ${partner?.firstName ?? 'your partner'}`, 'success');
  };

  const download = async () => {
    if (!mem.media) return toast('Nothing to download for this memory.');
    if (Platform.OS === 'web') {
      const w = globalThis as unknown as { open?: (u: string) => void };
      w.open?.(mem.media.uri);
      return;
    }
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(mem.media.uri);
      else toast('Sharing is not available on this device.');
    } catch {
      toast('Could not export this file.', 'error');
    }
  };

  const save = async () => {
    await backend.updateMemory(mem.id, { caption: caption.trim() || null, title: title.trim() || null, body: body.trim() || null });
    setEditing(false);
    toast('Saved', 'success');
  };

  return (
    <Screen footer={editing ? <><Button title="Save" onPress={save} /><Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} /></> : undefined}>
      <Header title={mem.kind === 'moment' ? 'Daily moment' : mem.kind[0].toUpperCase() + mem.kind.slice(1)} right={
        <Pressable accessibilityRole="button" accessibilityLabel={fav ? 'Remove favorite' : 'Add to favorites'} onPress={() => backend.toggleMemoryFavorite(mem.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={24} color={fav ? colors.primary : colors.textMuted} />
        </Pressable>
      } />
      <View style={{ gap: spacing.lg }}>
        {mem.kind === 'letter' ? (
          <Card style={{ gap: spacing.md }}>
            {editing ? <Input label="Title" value={title} onChangeText={setTitle} /> : <Txt variant="title">{mem.title ?? 'Letter'}</Txt>}
            {editing ? <Input label="Letter" value={body} onChangeText={setBody} multiline /> : <Txt style={{ lineHeight: 26 }}>{mem.body}</Txt>}
          </Card>
        ) : mem.kind === 'voice' && mem.media ? (
          <Card style={{ gap: spacing.md }}>
            <Txt variant="heading">{mem.title ?? 'Voice note'}</Txt>
            <VoicePlayer uri={mem.media.uri} durationMs={mem.media.durationMs} />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <MediaThumb media={mem.media} label={mem.caption ?? undefined} style={{ borderRadius: 0 }} />
          </Card>
        )}
        {mem.media?.uploadState === 'failed' ? <Banner kind="danger" title="Upload failed" body="The file is still on this device. Retry from the capture screen." /> : null}
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Avatar name={owner?.firstName ?? '?'} uri={owner?.avatarUri} size={28} simulated={owner?.isSimulated} />
            <Txt variant="bodyStrong">{owner?.firstName}{owner?.isSimulated ? ' (simulated)' : ''}</Txt>
            <Txt variant="caption" tone="muted">
              · {formatDate(mem.takenOn, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Txt>
          </View>
          {editing && mem.kind !== 'letter' ? <Input label="Caption" value={caption} onChangeText={setCaption} maxLength={140} /> : mem.caption ? <Txt>{mem.caption}</Txt> : null}
          {mem.favoritedBy.length ? (
            <Txt variant="caption" tone="muted">
              ♥ Favorited by {mem.favoritedBy.map((u) => (u === me.id ? 'you' : profiles[u]?.firstName)).join(' and ')}
            </Txt>
          ) : null}
        </Card>
        <View style={{ gap: spacing.sm }}>
          <Button title={`Share again with ${partner?.firstName ?? 'partner'}`} variant="secondary" onPress={reshare} disabled={!partner} />
          {mem.media ? <Button title="Download / export" variant="secondary" onPress={download} /> : null}
          {isOwner ? <Button title="Edit" variant="ghost" onPress={() => setEditing(true)} /> : null}
          {isOwner ? <Button title="Delete" variant="danger" onPress={remove} /> : <Txt variant="caption" tone="muted" center>Only {owner?.firstName} can delete this. You can remove it from your favorites.</Txt>}
        </View>
      </View>
    </Screen>
  );
}
