import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { TimezonePicker } from '@/components/TimezonePicker';
import { Avatar, Button, Header, Input, Screen, toast, Txt } from '@/components/ui';
import { pickFromLibrary } from '@/lib/media';
import { backend } from '@/services/backend';
import { useMe } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function EditProfile() {
  const me = useMe();
  const [name, setName] = useState(me?.firstName ?? '');
  const [pronouns, setPronouns] = useState(me?.pronouns ?? '');
  const [avatar, setAvatar] = useState<string | null>(me?.avatarUri ?? null);
  const [tz, setTz] = useState(me?.timezone ?? 'UTC');
  if (!me) return null;
  const save = async () => {
    if (!name.trim()) return toast('First name cannot be empty.', 'error');
    await backend.updateProfile({ firstName: name.trim(), pronouns: pronouns.trim() || null, avatarUri: avatar, timezone: tz });
    toast('Profile saved', 'success');
    router.back();
  };
  return (
    <Screen footer={<Button title="Save" size="lg" onPress={save} />}>
      <Header title="Edit profile" />
      <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl }}>
        <MotionPressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={async () => { const r = await pickFromLibrary({ square: true }); if (r && 'error' in r) toast(r.error, 'error'); else if (r) setAvatar(r.asset.uri); }}>
          <Avatar name={name} uri={avatar} size={96} />
        </MotionPressable>
        <Button title={avatar ? 'Change photo' : 'Add photo'} variant="ghost" size="sm" full={false} onPress={async () => { const r = await pickFromLibrary({ square: true }); if (r && 'error' in r) toast(r.error, 'error'); else if (r) setAvatar(r.asset.uri); }} />
        {avatar ? <Button title="Remove photo" variant="ghost" size="sm" full={false} onPress={() => setAvatar(null)} /> : null}
      </View>
      <View style={{ gap: spacing.lg }}>
        <Input label="First name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Pronouns (optional)" value={pronouns} onChangeText={setPronouns} autoCapitalize="none" placeholder="e.g. she/her" />
        <TimezonePicker label="Your time zone" value={tz} onChange={setTz} />
        <Txt variant="caption" tone="muted">
          Your time zone sets the local time your partner sees. The couple day boundary is a separate setting.
        </Txt>
      </View>
    </Screen>
  );
}
