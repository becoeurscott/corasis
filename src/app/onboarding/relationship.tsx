import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip, Txt } from '@/components/ui';
import { backend, Couple } from '@/services/backend';
import { useOnboarding } from '@/store/hooks';
import product from '../../../shared/product.json';
import { OnboardingTransition } from '@/components/OnboardingTransition';
import { spacing } from '@/theme/tokens';

const stages: { v: NonNullable<Couple['relationshipStage']>; l: string }[] = [
  { v: 'dating', l: 'Dating' },
  { v: 'committed', l: 'Together' },
  { v: 'engaged', l: 'Engaged' },
  { v: 'married', l: 'Married' },
  { v: 'other', l: 'Other' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="caption" tone="secondary" weight="600">
        {title}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>
    </View>
  );
}

export default function RelationshipStep() {
  const draft = useOnboarding();
  const [preparing, setPreparing] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!preparing) return;
    const timer = setTimeout(() => { router.push('/onboarding/connection'); setPreparing(false); started.current = false; }, product.onboardingTransition.durationMs);
    return () => clearTimeout(timer);
  }, [preparing]);
  const [stage, setStage] = useState(draft.relationshipStage);
  const [start, setStart] = useState(draft.relationshipStart);
  const [mode, setMode] = useState(draft.distanceMode);

  const save = (skip = false) => {
    if (started.current) return;
    started.current = true;
    backend.saveOnboarding(skip ? { step: Math.max(draft.step, 4) } : { relationshipStage: stage, relationshipStart: start, distanceMode: mode, step: Math.max(draft.step, 4) });
    setPreparing(true);
  };

  if (preparing) return <OnboardingTransition />;

  return (
    <OnboardingFrame step="relationship" title="The two of you" subtitle="Optional. Edit anytime." onContinue={() => save()} onSkip={() => save(true)} skipTitle="Skip">
      <View style={{ gap: spacing.md }}>
        <Section title="Relationship">
          {stages.map((s) => (
            <Chip key={s.v} label={s.l} selected={stage === s.v} onPress={() => setStage(stage === s.v ? null : s.v)} />
          ))}
        </Section>
        <DateField label="Start date (optional)" value={start} onChange={setStart} optional />
        <Section title="Living">
          <Chip label="Long distance" selected={mode === 'long_distance'} onPress={() => setMode('long_distance')} />
          <Chip label="Living nearby" selected={mode === 'nearby'} onPress={() => setMode('nearby')} />
        </Section>

      </View>
    </OnboardingFrame>
  );
}
