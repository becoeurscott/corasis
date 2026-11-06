import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { ThemePicker } from '@/components/ThemePicker';
import { Button, Card, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { backend } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { spacing, ThemeName } from '@/theme/tokens';

/** Mandatory first question. Theme applies immediately and persists. */
export default function ThemeStep() {
  const t = useT();
  const saved = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const [choice, setChoice] = useState<ThemeName | null>(saved);

  const pick = (name: ThemeName) => {
    setChoice(name);
    setTheme(name); // live preview on every subsequent screen
  };

  return (
    <OnboardingFrame
      step="theme"
      back={false}
      title={t('onboarding.theme.title')}
      subtitle={t('onboarding.theme.subtitle')}
      onContinue={() => {
        if (!choice) return;
        haptic('success');
        backend.saveOnboarding({ step: 1 });
        router.push('/onboarding/intro');
      }}
      continueDisabled={!choice}>
      <ThemePicker value={choice} onChange={pick} />
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Card tint>
          <Txt variant="caption" tone="secondary">
            Live preview · {choice ? `${choice[0].toUpperCase()}${choice.slice(1)} is on.` : 'Pick a color to see it everywhere.'} You can change it any time in Settings. Your partner keeps their own theme.
          </Txt>
          <View style={{ marginTop: spacing.md }}>
            <Button title="Example button" full={false} size="sm" />
          </View>
        </Card>
      </View>
    </OnboardingFrame>
  );
}
