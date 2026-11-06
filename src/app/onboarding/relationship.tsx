import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip, Txt } from '@/components/ui';
import { backend, Couple, Goal } from '@/services/backend';
import { useOnboarding } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

const stages: { v: NonNullable<Couple['relationshipStage']>; l: string }[] = [
  { v: 'dating', l: 'Dating' },
  { v: 'committed', l: 'In a relationship' },
  { v: 'engaged', l: 'Engaged' },
  { v: 'married', l: 'Married' },
  { v: 'other', l: 'Something else' },
];
const goals: { v: Goal; l: string }[] = [
  { v: 'deeper_conversations', l: 'Deeper conversations' },
  { v: 'daily_connection', l: 'More daily connection' },
  { v: 'playful_moments', l: 'Playful moments' },
  { v: 'planning_visits', l: 'Planning visits' },
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
  const [stage, setStage] = useState(draft.relationshipStage);
  const [start, setStart] = useState(draft.relationshipStart);
  const [mode, setMode] = useState(draft.distanceMode);
  const [picked, setPicked] = useState<Goal[]>(draft.goals);

  const save = (skip = false) => {
    backend.saveOnboarding(skip ? { step: Math.max(draft.step, 4) } : { relationshipStage: stage, relationshipStart: start, distanceMode: mode, goals: picked, step: Math.max(draft.step, 4) });
    router.push('/onboarding/auth');
  };

  return (
    <OnboardingFrame step="relationship" title="Your relationship" subtitle="All of this is optional. Answer what feels right." onContinue={() => save()} onSkip={() => save(true)} skipTitle="Skip these questions">
      <View style={{ gap: spacing.xl }}>
        <Section title="Where are you two right now?">
          {stages.map((s) => (
            <Chip key={s.v} label={s.l} selected={stage === s.v} onPress={() => setStage(stage === s.v ? null : s.v)} />
          ))}
        </Section>
        <DateField label="When did it start? (optional)" value={start} onChange={setStart} optional hint="Used for your anniversary and the day counter." />
        <Section title="Living situation">
          <Chip label="Long distance" selected={mode === 'long_distance'} onPress={() => setMode('long_distance')} />
          <Chip label="Living nearby" selected={mode === 'nearby'} onPress={() => setMode('nearby')} />
        </Section>
        <Section title="What would you like more of?">
          {goals.map((g) => (
            <Chip key={g.v} label={g.l} selected={picked.includes(g.v)} onPress={() => setPicked(picked.includes(g.v) ? picked.filter((x) => x !== g.v) : [...picked, g.v])} />
          ))}
        </Section>
      </View>
    </OnboardingFrame>
  );
}
