import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { VoicePlayer } from '@/components/messages/VoicePlayer';
import { Banner, Button, Txt } from '@/components/ui';
import { uid } from '@/lib/ids';
import type { MediaAsset } from '@/services/backend';
import { spacing } from '@/theme/tokens';
import { askPermission } from '@/lib/permissions';

const MAX_SECONDS = 90;

/** Record → preview → cancel/send. Microphone permission is requested on first tap. */
export function VoiceRecorder({ onSend, onCancel }: { onSend: (asset: MediaAsset) => void; onCancel: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      if (!(await askPermission('microphone'))) return;
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return setError('Microphone access is off. Enable it in system Settings to record a voice note.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(Platform.OS === 'web' ? 'Recording is not supported in this browser. It works in the mobile build.' : `Could not start recording: ${(e as Error).message}`);
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return setError('Nothing was recorded.');
      setPreview({ id: uid('media'), kind: 'voice', uri, durationMs: Math.round(state.durationMillis), uploadState: 'pending', createdAt: new Date().toISOString() });
      await setAudioModeAsync({ allowsRecording: false });
    } catch (e) {
      setError(`Could not stop recording: ${(e as Error).message}`);
    }
  };

  const seconds = Math.floor(state.durationMillis / 1000);
  if (state.isRecording && seconds >= MAX_SECONDS) stop();

  return (
    <View style={{ gap: spacing.md }}>
      {error ? <Banner kind="warning" body={error} /> : null}
      {preview ? (
        <>
          <VoicePlayer uri={preview.uri} durationMs={preview.durationMs} />
          <Button title="Send voice note" onPress={() => onSend(preview)} />
          <Button title="Record again" variant="secondary" onPress={() => setPreview(null)} />
          <Button title="Cancel" variant="ghost" onPress={onCancel} />
        </>
      ) : state.isRecording ? (
        <>
          <Txt variant="title" center>
            ● {seconds}s
          </Txt>
          <Txt variant="caption" tone="muted" center>
            Up to {MAX_SECONDS} seconds
          </Txt>
          <Button title="Stop" onPress={stop} />
          <Button title="Cancel" variant="ghost" onPress={async () => { try { await recorder.stop(); } catch { /* ignore */ } onCancel(); }} />
        </>
      ) : (
        <>
          <Txt tone="secondary" center>
            Tap to record. You can listen before sending.
          </Txt>
          <Button title="Start recording" onPress={start} />
          <Button title="Cancel" variant="ghost" onPress={onCancel} />
        </>
      )}
    </View>
  );
}
