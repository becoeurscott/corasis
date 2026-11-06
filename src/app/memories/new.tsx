import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { MediaThumb } from '@/components/MediaThumb';
import { VoiceRecorder } from '@/components/messages/VoiceRecorder';
import { Banner, Button, Chip, Header, Input, ProgressBar, Screen, toast, Txt } from '@/components/ui';
import { captureFromCamera, pickFromLibrary, uploadAsset } from '@/lib/media';
import { todayKey } from '@/lib/time';
import { backend, MediaAsset } from '@/services/backend';
import { useCouple } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

type Kind = 'photo' | 'voice' | 'letter';

export default function NewMemory() {
  const couple = useCouple();
  const [kind, setKind] = useState<Kind>('photo');
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState<string | null>(todayKey(couple?.coupleTimezone ?? 'UTC'));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!couple) {
    return (
      <Screen>
        <Header title="Add a memory" />
        <Banner kind="info" body="Connect with your partner to start your shared album." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
      </Screen>
    );
  }

  const save = async () => {
    setError(null);
    if (!date) return setError('Pick a date for this memory.');
    try {
      if (kind === 'letter') {
        if (!body.trim()) return setError('Write something first.');
        await backend.addMemory({ kind: 'letter', media: null, title: title.trim() || 'Letter', body: body.trim(), caption: null, takenOn: date });
      } else {
        if (!asset) return setError(kind === 'voice' ? 'Record a voice note first.' : 'Choose a photo or video first.');
        setProgress(0);
        const uploaded = await uploadAsset(asset, setProgress);
        await backend.addMemory({ kind: uploaded.kind === 'voice' ? 'voice' : uploaded.kind === 'video' ? 'video' : 'photo', media: uploaded, title: kind === 'voice' ? title.trim() || null : null, body: null, caption: caption.trim() || null, takenOn: date });
      }
      toast('Added to your album', 'success');
      router.back();
    } catch (e) {
      setProgress(null);
      setError((e as Error).message);
    }
  };

  const canSave = kind === 'letter' ? !!body.trim() : !!asset;

  return (
    <Screen footer={<Button title={progress != null ? 'Uploading…' : 'Save to album'} size="lg" onPress={save} disabled={!canSave} loading={progress != null} />}>
      <Header title="Add a memory" />
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Photo / video" selected={kind === 'photo'} onPress={() => setKind('photo')} />
          <Chip label="Voice note" selected={kind === 'voice'} onPress={() => setKind('voice')} />
          <Chip label="Letter" selected={kind === 'letter'} onPress={() => setKind('letter')} />
        </View>
        {error ? <Banner kind="danger" body={error} /> : null}
        {kind === 'photo' ? (
          <>
            {asset ? <MediaThumb media={asset} openViewer={false} onPress={() => setAsset(null)} /> : null}
            <Button title="Take a photo or video" variant="secondary" onPress={async () => { const r = await captureFromCamera(); if (r && 'error' in r) setError(r.error); else if (r) setAsset(r.asset); }} />
            <Button title="Choose from library" variant="secondary" onPress={async () => { const r = await pickFromLibrary({ allowVideo: true }); if (r && 'error' in r) setError(r.error); else if (r) setAsset(r.asset); }} />
            <Input label="Caption" value={caption} onChangeText={setCaption} maxLength={140} />
          </>
        ) : kind === 'voice' ? (
          <>
            {asset ? <Banner kind="success" body={`Voice note ready (${Math.round((asset.durationMs ?? 0) / 1000)} s).`} actionTitle="Record again" onAction={() => setAsset(null)} /> : <VoiceRecorder onSend={setAsset} onCancel={() => router.back()} />}
            <Input label="Title (optional)" value={title} onChangeText={setTitle} />
          </>
        ) : (
          <>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Before you land" />
            <Input label="Letter" value={body} onChangeText={setBody} multiline placeholder="Write it like you would say it." />
            <Txt variant="caption" tone="muted">
              Letters are private to the two of you and can be edited by the author.
            </Txt>
          </>
        )}
        <DateField label="Date" value={date} onChange={setDate} hint="When this happened." />
        {progress != null ? <ProgressBar value={progress} label="Upload progress" /> : null}
      </View>
    </Screen>
  );
}
