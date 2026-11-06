import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Avatar, Banner, Card, Input, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, useMe, useOnboarding, usePartner } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function CoupleStep() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const draft = useOnboarding();
  const [start, setStart] = useState(couple?.relationshipStart ?? draft.relationshipStart);
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
    <OnboardingFrame step="couple" title="The two of you" subtitle="Confirm the shared details. Either of you can edit them later." onContinue={next}>
      <View style={{ gap: spacing.lg }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flexDirection: 'row' }}>
            <Avatar name={me?.firstName ?? 'You'} uri={me?.avatarUri} size={56} ring />
            <View style={{ marginLeft: -16 }}>
              <Avatar name={partner?.firstName ?? '?'} uri={partner?.avatarUri} size={56} ring simulated={partner?.isSimulated} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">
              {me?.firstName} & {partner?.firstName}
            </Txt>
            {partner?.isSimulated ? (
              <Txt variant="caption" tone="muted">
                {partner.firstName} is a simulated partner for the demo.
              </Txt>
            ) : null}
          </View>
        </Card>
        <DateField label="Relationship start date" value={start} onChange={setStart} optional />
        <Txt variant="heading">Next meeting (optional)</Txt>
        <DateField label="When?" value={meetDate} onChange={setMeetDate} optional minToday />
        <Input label="Where?" value={dest} onChangeText={setDest} placeholder="e.g. Montréal" />
        {!couple ? <Banner kind="info" body="You are not connected yet. These details are saved and applied once your partner joins." /> : null}
      </View>
    </OnboardingFrame>
  );
}
