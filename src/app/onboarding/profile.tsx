import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { TimezonePicker } from '@/components/TimezonePicker';
import { Avatar, Input, PRESET_AVATARS, toast, Txt } from '@/components/ui';
import { pickFromLibrary } from '@/lib/media';
import { useReducedMotion } from '@/lib/motion';
import { deviceTimezone } from '@/lib/time';
import { backend } from '@/services/backend';
import { useOnboarding } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileStep() {
  const draft = useOnboarding();
  const { colors } = useTheme();
  const [name, setName] = useState(draft.firstName);
  const [avatar, setAvatar] = useState<string | null>(draft.avatarUri);
  const [tz, setTz] = useState(draft.timezone ?? deviceTimezone());
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    // Collapse the photo choices with the keyboard, rather than on the initial tap.
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', event => {
      if (!reducedMotion) Keyboard.scheduleLayoutAnimation(event);
      setFocused(true);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', event => {
      if (!reducedMotion) Keyboard.scheduleLayoutAnimation(event);
      setFocused(false);
    });
    return () => { show.remove(); hide.remove(); };
  }, [reducedMotion]);
  const [error, setError] = useState<string | null>(null);
  const choosePhoto = async () => { const res = await pickFromLibrary({ square: true }); if (res && 'error' in res) return toast(res.error, 'error'); if (res) setAvatar(res.asset.uri); };
  const next = () => {
    const trimmed = name.trim(); if (!trimmed) return setError('Enter your first name.');
    backend.saveOnboarding({ firstName: trimmed, avatarUri: avatar, timezone: tz, step: Math.max(draft.step, 3) });
    router.push('/onboarding/relationship');
  };
  return <OnboardingFrame step="profile" title="What should we call you?" subtitle="Just your first name." onContinue={next} continueDisabled={!name.trim()}>
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <MotionPressable accessibilityRole="button" accessibilityLabel={avatar ? 'Change your photo' : 'Add a profile photo'} onPress={choosePhoto}>
          <View style={{ width: focused ? 64 : 104, height: focused ? 64 : 104, borderRadius: 52, borderWidth: avatar ? 0 : 2, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
            {avatar ? <Avatar name={name || '?'} uri={avatar} size={focused ? 64 : 104} /> : <Txt style={{ fontSize: focused ? 24 : 36 }}>📷</Txt>}
          </View>
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}><Txt style={{ color: colors.onPrimary, fontSize: 16, fontWeight: '800', lineHeight: 20 }}>{avatar ? '✎' : '+'}</Txt></View>
        </MotionPressable>
        {!focused ? <MotionPressable accessibilityRole="button" onPress={choosePhoto} hitSlop={8}><Txt variant="bodyStrong" tone="primary">{avatar && !avatar.startsWith('avatar:') ? 'Change photo' : 'Add your photo'}</Txt></MotionPressable> : null}
      </View>
      {!focused ? <View style={{ gap: 8 }}>
        <Txt variant="caption" tone="secondary" center>Or pick an avatar</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          {PRESET_AVATARS.map(e => { const value = `avatar:${e}`; const on = avatar === value; return (
            <MotionPressable key={e} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Avatar ${e}`} onPress={() => setAvatar(on ? null : value)}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: on ? colors.primary : 'transparent' }}>
              <Txt style={{ fontSize: 26, lineHeight: 32 }}>{e}</Txt>
            </MotionPressable>); })}
        </View>
      </View> : null}
      <Input label="First name" value={name} onChangeText={v => { setName(v); setError(null); }} placeholder="e.g. Sam" autoCapitalize="words" autoComplete="given-name" error={error} onSubmitEditing={next} returnKeyType="next" />
      {!focused ? <TimezonePicker label="Your time zone" value={tz} onChange={setTz} /> : null}
    </View>
  </OnboardingFrame>;
}
