import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Avatar, Button, Card, Chip, Header, Screen, toast, Txt } from '@/components/ui';
import { backend, Couple } from '@/services/backend';
import { useCouple, useMe, usePartner } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

const stages: { v: NonNullable<Couple['relationshipStage']>; l: string }[] = [
  { v: 'dating', l: 'Dating' }, { v: 'committed', l: 'In a relationship' }, { v: 'engaged', l: 'Engaged' }, { v: 'married', l: 'Married' }, { v: 'other', l: 'Something else' },
];

export default function CoupleDetails() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const [start, setStart] = useState(couple?.relationshipStart ?? null);
  const [stage, setStage] = useState(couple?.relationshipStage ?? null);
  const [mode, setMode] = useState(couple?.distanceMode ?? null);
  if (!couple || !me) {
    return (
      <Screen>
        <Header title="Couple details" />
        <Txt tone="secondary">Connect with your partner first.</Txt>
      </Screen>
    );
  }
  const save = async () => {
    await backend.updateCouple({ relationshipStart: start, relationshipStage: stage, distanceMode: mode });
    toast('Saved', 'success');
    router.back();
  };
  return (
    <Screen footer={<Button title="Save" size="lg" onPress={save} />}>
      <Header title="Couple details" />
      <View style={{ gap: spacing.lg }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flexDirection: 'row' }}>
            <Avatar name={me.firstName} uri={me.avatarUri} size={52} ring />
            <View style={{ marginLeft: -14 }}>
              <Avatar name={partner?.firstName ?? '?'} uri={partner?.avatarUri} size={52} ring simulated={partner?.isSimulated} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{me.firstName} & {partner?.firstName}</Txt>
            <Txt variant="caption" tone="muted">
              Shared with both of you · either can edit
            </Txt>
          </View>
        </Card>
        <DateField label="Relationship start date" value={start} onChange={setStart} optional />
        <View style={{ gap: spacing.sm }}>
          <Txt variant="caption" tone="secondary" weight="600">
            Stage
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {stages.map((s) => (
              <Chip key={s.v} label={s.l} selected={stage === s.v} onPress={() => setStage(stage === s.v ? null : s.v)} small />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Txt variant="caption" tone="secondary" weight="600">
            Living situation
          </Txt>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Long distance" selected={mode === 'long_distance'} onPress={() => setMode('long_distance')} small />
            <Chip label="Living nearby" selected={mode === 'nearby'} onPress={() => setMode('nearby')} small />
          </View>
        </View>
      </View>
    </Screen>
  );
}
