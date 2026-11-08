import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Card, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const items = [
  { emoji: '🔥', title: 'Daily moments', body: 'A photo. A little moment.' },
  { emoji: '💬', title: 'Private activities', body: 'Discover each other.' },
  { emoji: '📖', title: 'Shared memories', body: 'Your favorite moments, together.' },
];

export default function IntroStep() {
  const { colors } = useTheme();
  const next = () => {
    backend.saveOnboarding({ introSeen: true, step: 2 });
    router.push('/onboarding/profile');
  };
  return (
    <OnboardingFrame step="intro" title="A little closer, every day." subtitle="Small moments. More connection." onContinue={next} onSkip={next} skipTitle="Skip">
      <View style={{ gap: spacing.md }}>
        {items.map((it) => (
          <Card key={it.title} style={[styles.row, { padding: 12 }]}>
            <View style={[styles.emoji, { backgroundColor: colors.primarySoft }]}>
              <Txt style={{ fontSize: 24 }}>{it.emoji}</Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{it.title}</Txt>
              <Txt variant="caption" tone="secondary">{it.body}</Txt>
            </View>
          </Card>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' }, emoji: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' } });
