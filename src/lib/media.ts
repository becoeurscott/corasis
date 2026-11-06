import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { uid } from '@/lib/ids';
import type { MediaAsset } from '@/services/backend';

export const MAX_VIDEO_SECONDS = 30;
export const MAX_FILE_BYTES = 60 * 1024 * 1024;

export type PickResult = { asset: MediaAsset } | { error: string } | null;

function toAsset(a: ImagePicker.ImagePickerAsset): MediaAsset {
  const kind = a.type === 'video' ? 'video' : 'photo';
  return { id: uid('media'), kind, uri: a.uri, width: a.width, height: a.height, durationMs: a.duration ?? undefined, sizeBytes: a.fileSize ?? undefined, uploadState: 'pending', createdAt: new Date().toISOString() };
}

function validate(asset: MediaAsset): string | null {
  if (asset.sizeBytes && asset.sizeBytes > MAX_FILE_BYTES) return 'That file is larger than 60 MB. Pick a smaller one or trim the video.';
  if (asset.kind === 'video' && asset.durationMs && asset.durationMs > MAX_VIDEO_SECONDS * 1000) return `Videos are limited to ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`;
  return null;
}

/** Requests camera permission only when the user actually taps "Take photo". */
export async function captureFromCamera(allowVideo = true): Promise<PickResult> {
  if (Platform.OS === 'web') return { error: 'The camera is not available in the browser preview. Choose from your files instead.' };
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { error: 'Camera access is off. You can enable it in system Settings, or pick from your library instead.' };
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: allowVideo ? ['images', 'videos'] : ['images'], quality: 0.85, videoMaxDuration: MAX_VIDEO_SECONDS, allowsEditing: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = toAsset(res.assets[0]);
  const err = validate(asset);
  return err ? { error: err } : { asset };
}

export async function pickFromLibrary(opts: { allowVideo?: boolean; square?: boolean } = {}): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && Platform.OS !== 'web') return { error: 'Photo library access is off. Enable it in system Settings to pick a photo.' };
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: opts.allowVideo ? ['images', 'videos'] : ['images'], quality: 0.85, allowsEditing: !!opts.square, aspect: opts.square ? [1, 1] : undefined, videoMaxDuration: MAX_VIDEO_SECONDS });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = toAsset(res.assets[0]);
  const err = validate(asset);
  return err ? { error: err } : { asset };
}

/**
 * Simulated upload with progress. In demo mode media stays on-device (the
 * local URI is the "uploaded" URI). A remote backend would stream to private
 * storage here and return a storage key.
 */
export async function uploadAsset(asset: MediaAsset, onProgress: (p: number) => void, opts: { failOnce?: boolean } = {}): Promise<MediaAsset> {
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await new Promise((r) => setTimeout(r, 110));
    onProgress(i / steps);
    if (opts.failOnce && i === 4) throw new Error('Upload interrupted. Check your connection and retry.');
  }
  return { ...asset, uploadState: 'uploaded' };
}
