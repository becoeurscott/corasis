import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { MediaThumb } from '@/components/MediaThumb';
import { Banner, Button, Card, Header, Input, ProgressBar, Screen, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { uid } from '@/lib/ids';
import { captureFromCamera, MAX_VIDEO_SECONDS, pickFromLibrary, uploadAsset } from '@/lib/media';
import { backend, MediaAsset } from '@/services/backend';
import { useCouple } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

type Phase = 'pick' | 'preview' | 'uploading' | 'failed' | 'done';

/** Capture → preview → caption → upload with progress, retry and success. */
export default function CaptureMoment() {
  const couple = useCouple();
  const params = useLocalSearchParams<{ challenge?: string }>();
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [caption, setCaption] = useState(params.challenge ? `Photo challenge: ${params.challenge}` : '');
  const [phase, setPhase] = useState<Phase>('pick');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(uid('req')); // idempotency key survives retries
  const attempts = useRef(0);

  const handlePick = (res: Awaited<ReturnType<typeof pickFromLibrary>>) => {
    if (!res) return;
    if ('error' in res) return setError(res.error);
    setError(null);
    setAsset(res.asset);
    setPhase('preview');
  };

  const send = async () => {
    if (!asset || !couple) return;
    setPhase('uploading');
    setProgress(0);
    attempts.current += 1;
    try {
      // Demo: the very first attempt in a session can be made to fail to show the retry path (?simulateFail=1).
      const uploaded = await uploadAsset(asset, setProgress, { failOnce: params.challenge === '__fail__' && attempts.current === 1 });
      await backend.addMoment(uploaded, caption.trim() || null, requestId.current);
      haptic('success');
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
      setPhase('failed');
    }
  };

  if (!couple) {
    return (
      <Screen>
        <Header title="Send a moment" />
        <Banner kind="warning" title="Not connected yet" body="Moments are shared with your partner. Connect first to start the flame." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
      </Screen>
    );
  }

  return (
    <Screen footer={phase === 'preview' ? <><Button title="Send to partner" size="lg" onPress={send} /><Button title="Retake / choose another" variant="ghost" onPress={() => { setAsset(null); setPhase('pick'); }} /></> : phase === 'failed' ? <><Button title="Retry upload" size="lg" onPress={send} /><Button title="Cancel" variant="ghost" onPress={() => router.back()} /></> : phase === 'done' ? <Button title="Back to Home" size="lg" onPress={() => router.replace('/(tabs)')} /> : undefined}>
      <Header title="Send a moment" />
      <View style={{ gap: spacing.lg }}>
        {phase === 'pick' ? (
          <>
            <Txt tone="secondary">One photo or video of your day. Videos up to {MAX_VIDEO_SECONDS} s. Nothing is posted publicly.</Txt>
            {error ? <Banner kind="warning" body={error} /> : null}
            <Button title="Take a photo or video" size="lg" onPress={async () => handlePick(await captureFromCamera(true))} />
            <Button title="Choose from library" variant="secondary" onPress={async () => handlePick(await pickFromLibrary({ allowVideo: true }))} />
            {Platform.OS === 'web' ? <Banner kind="info" body="In the browser preview, the camera is unavailable; the file picker works. The mobile build uses the native camera and asks for permission the first time." /> : null}
          </>
        ) : null}

        {asset && phase !== 'pick' ? (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <MediaThumb media={{ ...asset, uploadState: phase === 'uploading' ? 'uploading' : phase === 'failed' ? 'failed' : phase === 'done' ? 'uploaded' : 'pending' }} openViewer={phase === 'done'} />
          </Card>
        ) : null}

        {phase === 'preview' ? (
          <>
            {asset?.kind === 'video' ? <Txt variant="caption" tone="muted">Trimming is available in the mobile build's native editor; the preview keeps the clip as selected.</Txt> : null}
            <Input label="Caption (optional)" value={caption} onChangeText={setCaption} placeholder="A few words about this moment" maxLength={140} multiline />
          </>
        ) : null}

        {phase === 'uploading' ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="bodyStrong">Uploading… {Math.round(progress * 100)}%</Txt>
            <ProgressBar value={progress} label="Upload progress" />
          </View>
        ) : null}

        {phase === 'failed' ? <Banner kind="danger" title="Upload failed" body={error ?? 'Something went wrong.'} /> : null}

        {phase === 'done' ? <Banner kind="success" title="Moment sent" body="It is saved in your private album. The flame validates once your partner sends theirs today." /> : null}
      </View>
    </Screen>
  );
}
