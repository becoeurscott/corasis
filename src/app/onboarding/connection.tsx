import { MotionPressable } from '@/components/ui/MotionPressable';
import { router, useCanGoBack } from 'expo-router';
import React from 'react';
import { useWindowDimensions, View } from 'react-native';

import { ConnectionQuestions } from '@/components/ConnectionQuestions';
import { Screen, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useOnboarding } from '@/store/hooks';

export default function ConnectionOnboarding() {
  const draft = useOnboarding();
  const canGoBack = useCanGoBack();
  const { height } = useWindowDimensions();
  return <Screen scroll={false} contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
    {height >= 650 ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 32 }}>
      <Txt variant="bodyStrong">corasis</Txt>
      {canGoBack ? <MotionPressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}><Txt variant="caption" tone="secondary">Previous step</Txt></MotionPressable> : null}
    </View> : null}
    <ConnectionQuestions onBack={canGoBack ? () => router.back() : undefined} fitScreen initial={draft.connectionDraft?.answers ?? {}} onDraft={answers => backend.saveConnectionDraft(answers)} finishTitle="Continue" onFinish={answers => { backend.saveConnectionDraft(answers, true); router.push('/auth/sign-in'); }} />
  </Screen>;
}
