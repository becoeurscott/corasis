import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { TimezonePicker } from '@/components/TimezonePicker';
import { Avatar, Chip, Input, toast, Txt } from '@/components/ui';
import { pickFromLibrary } from '@/lib/media';
import { deviceTimezone } from '@/lib/time';
import { backend } from '@/services/backend';
import { useOnboarding } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

const pronounOptions = ['she/her', 'he/him', 'they/them'];

export default function ProfileStep() {
  const draft = useOnboarding();
  const [name, setName] = useState(draft.firstName);
  const [avatar, setAvatar] = useState<string | null>(draft.avatarUri);
  const [pronouns, setPronouns] = useState<string | null>(draft.pronouns);
  const [custom, setCustom] = useState(draft.pronouns && !pronounOptions.includes(draft.pronouns) ? draft.pronouns : '');
  const [tz, setTz] = useState(draft.timezone ?? deviceTimezone());
  const [error, setError] = useState<string | null>(null);

  const choosePhoto = async () => {
    const res = await pickFromLibrary({ square: true });
    if (res && 'error' in res) return toast(res.error, 'error');
    if (res) setAvatar(res.asset.uri);
  };

  const next = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Your first name helps your partner recognize you.');
    backend.saveOnboarding({ firstName: trimmed, avatarUri: avatar, pronouns: custom.trim() || pronouns, timezone: tz, step: Math.max(draft.step, 3) });
    router.push('/onboarding/relationship');
  };

  return (
    <OnboardingFrame step="profile" title="About you" subtitle="Only your partner sees this." onContinue={next} continueDisabled={!name.trim()}>
      <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a profile photo" onPress={choosePhoto}>
          <Avatar name={name || '?'} uri={avatar} size={96} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={choosePhoto} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
          <Txt variant="caption" tone="primary" weight="700">
            {avatar ? 'Change photo' : 'Add a photo (optional)'}
          </Txt>
        </Pressable>
      </View>
      <View style={{ gap: spacing.lg }}>
        <Input label="First name" value={name} onChangeText={(v) => { setName(v); setError(null); }} placeholder="e.g. Sam" autoCapitalize="words" autoComplete="given-name" error={error} returnKeyType="next" />
        <View style={{ gap: spacing.sm }}>
          <Txt variant="caption" tone="secondary" weight="600">
            Pronouns (optional)
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {pronounOptions.map((p) => (
              <Chip key={p} label={p} selected={pronouns === p && !custom} onPress={() => { setPronouns(pronouns === p ? null : p); setCustom(''); }} />
            ))}
          </View>
          <Input value={custom} onChangeText={setCustom} placeholder="Or write your own" autoCapitalize="none" />
        </View>
        <TimezonePicker label="Your time zone" value={tz} onChange={setTz} hint="Detected from your device. Tap to change." />
      </View>
    </OnboardingFrame>
  );
}
