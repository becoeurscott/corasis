import { router } from 'expo-router';
import React, { useState } from 'react';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { ThemePicker } from '@/components/ThemePicker';
import { Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { backend } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { ThemeName } from '@/theme/tokens';

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
      <ThemePicker compact value={choice} onChange={pick} />
      <Txt variant="caption" tone="muted" style={{ marginTop: 12 }}>Change your colors anytime.</Txt>
    </OnboardingFrame>
  );
}
