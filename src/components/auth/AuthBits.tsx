import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { toast, Txt } from '@/components/ui';
import { resolveStartRoute } from '@/lib/routing';
import { backend, useData } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function FieldIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={20} color={colors.textMuted} />;
}

/** "Already have an account? Log in" on one line, the action in bold. */
export function SwitchLine({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${prompt} ${action}`} onPress={onPress} hitSlop={8} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
      <Txt tone="secondary" center>
        {prompt} <Txt weight="700">{action}</Txt>
      </Txt>
    </Pressable>
  );
}

/** Privacy & Terms row that folds out its note, with a link to the full page. */
export function PrivacyFold({ note }: { note: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Txt weight="700" tone="secondary">Privacy & Terms</Txt>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      <Txt variant="caption" tone="secondary">{note}</Txt>
      {open ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/settings/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Txt variant="caption" tone="primary" weight="600">Read the full Privacy & Terms</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

type Provider = 'Google' | 'Apple';
const PROVIDERS: { name: Provider; icon: keyof typeof Ionicons.glyphMap; color: string; dark?: boolean }[] = [
  { name: 'Google', icon: 'logo-google', color: '#EA4335' },
  { name: 'Apple', icon: 'logo-apple', color: '#FFFFFF', dark: true },
];

/** "or continue with" divider plus Google / Apple pill buttons. */
export function SocialButtons({ onPress, busy }: { onPress: (p: Provider) => void; busy?: Provider | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Txt tone="secondary">or continue with</Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      {PROVIDERS.map((p) => (
        <Pressable key={p.name} accessibilityRole="button" accessibilityLabel={`Continue with ${p.name}`} disabled={!!busy} accessibilityState={{ busy: busy === p.name }} onPress={() => onPress(p.name)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54, borderRadius: 999, borderWidth: p.dark ? 0 : 1.5, borderColor: colors.border, backgroundColor: p.dark ? '#000' : colors.surface, opacity: pressed ? 0.8 : 1 })}>
          {busy === p.name ? <ActivityIndicator color={p.dark ? '#fff' : colors.textMuted} /> : <Ionicons name={p.icon} size={22} color={p.color} />}
          <Txt weight="700" style={{ color: p.dark ? '#fff' : colors.text, fontSize: 17 }}>{p.name}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

/** Runs Google / Apple sign-in, then routes like a normal sign-in. */
export function useSocialSignIn() {
  const [busy, setBusy] = useState<Provider | null>(null);
  const run = async (p: Provider) => {
    if (busy) return;
    setBusy(p);
    try {
      const session = await backend.signInWithOAuth(p.toLowerCase() as 'google' | 'apple', Linking.createURL('auth'));
      if (!session) return;
      backend.saveOnboarding({ step: 4 });
      const { onboarding, session: s, pendingInviteCode } = useData.getState();
      router.replace(resolveStartRoute({ theme: usePrefs.getState().theme, onboarding, session: s, couple: backend.couple(), pendingInviteCode }) as never);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };
  return { run, busy };
}
