import { useStepFade } from '@/lib/motion';
import { MotionPressable } from '@/components/ui/MotionPressable';
import React, { useEffect, useState } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';

import { Banner, Button, Card, ProgressBar, Txt } from '@/components/ui';
import { connectionFlow, connectionRecommendation } from '@/lib/connectionPreferences';
import { useTheme } from '@/theme/ThemeProvider';

interface Props { initial: Record<string, string>; fitScreen?: boolean; onBack?: () => void; onDraft?: (answers: Record<string,string>) => void; onStepChange?: () => void; onFinish: (answers: Record<string,string>) => Promise<void> | void; finishTitle: string }
export function ConnectionQuestions({ initial, fitScreen = false, onBack, onDraft, onStepChange, onFinish, finishTitle }: Props) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const compact = fitScreen && height < 720;
  const [answers, setAnswers] = useState(initial);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const stepOpacity = useStepFade(index);
  const [error, setError] = useState('');
  useEffect(() => { onStepChange?.(); }, [index, onStepChange]);
  const question = connectionFlow.questions[index];
  const option = question?.options.find(o => o.id === answers[question.id]);
  const write = (next: Record<string,string>) => { setAnswers(next); onDraft?.(next); };
  const finish = async () => { setBusy(true); setError(''); try { await onFinish(answers); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const recommendation = connectionRecommendation({ version: 1, answers, completed: true, updatedAt: '' });
  return <View style={{ flex: fitScreen ? 1 : undefined, gap: compact ? 8 : 16 }}>
    <View style={{ gap: 8 }}>
      <Txt variant="caption" tone="secondary">{question ? `${index + 1} of ${connectionFlow.questions.length} · Make it yours` : 'Ready for a little connection?'}</Txt>
      <ProgressBar value={(index + 1) / (connectionFlow.questions.length + 1)} label="Personalization questions" />
    </View>
    <Animated.View style={{ opacity: stepOpacity, gap: compact ? 8 : 16 }}>
    {question ? <>
      <View style={{ gap: 4 }}><Txt variant="title" accessibilityRole="header">{question.title}</Txt>{!compact ? <Txt variant="caption" tone="secondary">{question.subtitle}</Txt> : null}</View>
      <View style={{ gap: compact ? 6 : 10 }}>
        {question.options.map(choice => <MotionPressable key={choice.id} accessibilityRole="radio" accessibilityState={{ checked: answers[question.id] === choice.id }} onPress={() => write({ ...answers, [question.id]: choice.id })} style={{ paddingHorizontal: 16, paddingVertical: compact ? 8 : 14, borderRadius: 16, backgroundColor: answers[question.id] === choice.id ? colors.primarySoft : colors.surface, borderWidth: 1, borderColor: answers[question.id] === choice.id ? colors.primary : colors.border, minHeight: compact ? 44 : 52 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Txt style={{ flex: 1 }} variant="bodyStrong">{choice.label}</Txt><Txt tone="primary">{answers[question.id] === choice.id ? '●' : '○'}</Txt></View>
        </MotionPressable>)}
      </View>
      <View style={{ minHeight: compact ? 20 : 36, justifyContent: 'center' }}><Txt variant="caption" tone="primary" accessibilityLiveRegion="polite">{option?.response ?? 'Choose one, or skip.'}</Txt></View>
    </> : <>
      <Txt variant="title" accessibilityRole="header">{connectionFlow.summaryTitle}</Txt>
      <Txt tone="secondary">{connectionFlow.summaryBody}</Txt>
      {recommendation ? <Card tint><Txt variant="heading">{recommendation.deck.emoji} {recommendation.deck.title}</Txt><Txt variant="caption">{recommendation.body}</Txt><Txt variant="caption" tone="secondary">{recommendation.duration}</Txt></Card> : <Card><Txt>Explore at your own pace.</Txt></Card>}
    </>}
    </Animated.View>
    {fitScreen ? <View style={{ flex: 1, minHeight: 0 }} /> : null}
    {error ? <Banner kind="danger" body={error} /> : null}
    <View style={{ gap: 4 }}>
      <Button title={question ? 'Continue' : finishTitle} size={compact ? 'sm' : 'md'} onPress={question ? () => setIndex(index + 1) : finish} disabled={question ? !option : busy} loading={busy} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {index > 0 || onBack ? <Button title="Back" size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => { if (index > 0) setIndex(index - 1); else onBack?.(); }} disabled={busy} /> : null}
        {question ? <Button title="Skip" size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => { const next = { ...answers }; delete next[question.id]; write(next); setIndex(index + 1); }} /> : null}
      </View>
      <Txt variant="caption" tone="muted" center>{connectionFlow.privacy}</Txt>
    </View>
  </View>;
}
