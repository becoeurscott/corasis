import { useCanGoBack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Header, ProgressBar, Screen, Txt } from '@/components/ui';
import { useReducedMotion } from '@/lib/motion';
import { onboardingSteps, OnboardingStep } from '@/lib/routing';

interface Props {
  step: OnboardingStep; title: string; subtitle?: string; children: React.ReactNode;
  onContinue?: () => void; continueTitle?: string; continueDisabled?: boolean; loading?: boolean;
  onSkip?: () => void; skipTitle?: string; back?: boolean; scroll?: boolean;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}
/** Fixed onboarding canvas with short copy and actions anchored below the content. */
export function OnboardingFrame({ step, title, subtitle, children, onContinue, continueTitle = 'Continue', continueDisabled, loading, onSkip, skipTitle = 'Skip', back = true, scroll = false, scrollRef }: Props) {
  const idx = onboardingSteps.indexOf(step);
  const canGoBack = useCanGoBack();
  const { height } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  const reducedMotion = useReducedMotion();
  const compact = height < 720 || keyboard;
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', event => { if (!reducedMotion) Keyboard.scheduleLayoutAnimation(event); setKeyboard(true); });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', event => { if (!reducedMotion) Keyboard.scheduleLayoutAnimation(event); setKeyboard(false); });
    return () => { show.remove(); hide.remove(); };
  }, [reducedMotion]);
  return <Screen scroll={scroll} scrollRef={scrollRef} contentStyle={{ flex: 1, paddingTop: 4, paddingBottom: 4 }}
    footer={onContinue || onSkip ? <View style={{ gap: 4 }}>
      {onContinue ? <Button title={continueTitle} onPress={onContinue} disabled={continueDisabled} loading={loading} size={compact ? 'sm' : 'md'} /> : null}
      {onSkip ? <Button title={skipTitle} variant="ghost" onPress={onSkip} size="sm" /> : null}
    </View> : undefined}>
    <Header back={back && canGoBack} right={<Txt variant="caption" tone="muted">{idx + 1}/{onboardingSteps.length}</Txt>} />
    <ProgressBar value={(idx + 1) / onboardingSteps.length} label="Onboarding progress" />
    <View style={{ gap: 4, marginTop: compact ? 8 : 14, marginBottom: compact ? 12 : 20 }}>
      <Txt variant="title" accessibilityRole="header">{title}</Txt>
      {subtitle && !keyboard ? <Txt variant="caption" tone="secondary">{subtitle}</Txt> : null}
    </View>
    {children}
  </Screen>;
}
