import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Card, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const items = [
  { emoji: '🔥', title: 'Daily moments', body: 'Share one photo or video a day. When you both do, your flame grows.' },
  { emoji: '💬', title: 'Private activities', body: 'Questions and games, answered separately and revealed together.' },
  { emoji: '📖', title: 'Shared memories', body: 'Everything you send lands in a private album only you two can see.' },
];

export default function IntroStep() {
  const { colors } = useTheme();
  const next = () => {
    backend.saveOnboarding({ introSeen: true, step: 2 });
    router.push('/onboarding/profile');
  };
  return (
    <OnboardingFrame step="intro" title="A small daily ritual" subtitle="Three things Together is built around." onContinue={next} onSkip={next} skipTitle="Skip">
      <View style={{ gap: spacing.md }}>
        {items.map((it) => (
          <Card key={it.title} style={styles.row}>
            <View style={[styles.emoji, { backgroundColor: colors.primarySoft }]}>
              <Txt style={{ fontSize: 24 }}>{it.emoji}</Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{it.title}</Txt>
              <Txt tone="secondary">{it.body}</Txt>
            </View>
          </Card>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' }, emoji: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' } });
