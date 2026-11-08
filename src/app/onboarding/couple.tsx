import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Banner, Input } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, useOnboarding } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function CoupleStep() {
  const couple = useCouple();
  const draft = useOnboarding();
  const start = couple?.relationshipStart ?? draft.relationshipStart;
  const [meetDate, setMeetDate] = useState<string | null>(draft.nextMeetingDate);
  const [dest, setDest] = useState(draft.nextMeetingDestination ?? '');

  const next = async () => {
    if (couple) {
      await backend.updateCouple({ relationshipStart: start });
      if (meetDate && !backend.events().some((e) => e.kind === 'meeting' && !e.cancelled && e.date >= new Date().toISOString().slice(0, 10))) {
        await backend.upsertEvent({ kind: 'meeting', title: 'Next visit', date: meetDate, allDay: true, time: null, timezone: couple.coupleTimezone, destination: dest.trim() || null, notes: null, recurringAnnual: false, reminders: [7, 1, 0], cancelled: false });
      }
    }
    backend.saveOnboarding({ relationshipStart: start, nextMeetingDate: meetDate, nextMeetingDestination: dest, step: 6 });
    router.push('/onboarding/privacy');
  };

  return (
    <OnboardingFrame step="couple" title="Your next visit" subtitle="Optional. Something to look forward to." onContinue={next}>
      <View style={{ gap: spacing.lg }}>
        <DateField label="When?" value={meetDate} onChange={setMeetDate} optional minToday />
        <Input label="Where?" value={dest} onChangeText={setDest} placeholder="e.g. Montréal" />
        {!couple ? <Banner kind="info" body="You can plan this later." /> : null}
      </View>
    </OnboardingFrame>
  );
}
