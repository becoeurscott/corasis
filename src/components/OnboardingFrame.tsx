import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button, Header, ProgressBar, Screen, Txt } from '@/components/ui';
import { onboardingSteps, OnboardingStep } from '@/lib/routing';
import { spacing } from '@/theme/tokens';

interface Props {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onContinue?: () => void;
  continueTitle?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  onSkip?: () => void;
  skipTitle?: string;
  back?: boolean;
  scroll?: boolean;
}

/** Shared chrome for onboarding: progress, back, sticky Continue. */
export function OnboardingFrame({ step, title, subtitle, children, onContinue, continueTitle = 'Continue', continueDisabled, loading, onSkip, skipTitle = 'Skip for now', back = true, scroll = true }: Props) {
  const idx = onboardingSteps.indexOf(step);
  return (
    <Screen
      scroll={scroll}
      footer={
        onContinue || onSkip ? (
          <>
            {onContinue ? <Button title={continueTitle} onPress={onContinue} disabled={continueDisabled} loading={loading} size="lg" accessibilityHint={continueDisabled ? 'Make a selection to continue' : undefined} /> : null}
            {onSkip ? <Button title={skipTitle} variant="ghost" onPress={onSkip} /> : null}
          </>
        ) : undefined
      }>
      <Header back={back && router.canGoBack()} right={<Txt variant="caption" tone="muted">{idx + 1}/{onboardingSteps.length}</Txt>} />
      <ProgressBar value={(idx + 1) / onboardingSteps.length} label="Onboarding progress" />
      <View style={{ gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.xl }}>
        <Txt variant="display" accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? <Txt tone="secondary">{subtitle}</Txt> : null}
      </View>
      {children}
    </Screen>
  );
}
