import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { TimezonePicker } from '@/components/TimezonePicker';
import { Banner, Button, Header, Screen, toast, Txt } from '@/components/ui';
import { todayKey } from '@/lib/time';
import { backend } from '@/services/backend';
import { useCouple, useMe } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function TimezoneSettings() {
  const me = useMe();
  const couple = useCouple();
  const [mine, setMine] = useState(me?.timezone ?? 'UTC');
  const [coupleTz, setCoupleTz] = useState(couple?.coupleTimezone ?? me?.timezone ?? 'UTC');
  if (!me) return null;
  const save = async () => {
    await backend.updateProfile({ timezone: mine });
    if (couple && coupleTz !== couple.coupleTimezone) await backend.updateCouple({ coupleTimezone: coupleTz });
    toast('Saved', 'success');
    router.back();
  };
  return (
    <Screen footer={<Button title="Save" size="lg" onPress={save} />}>
      <Header title="Time zone & couple day" />
      <View style={{ gap: spacing.lg }}>
        <TimezonePicker label="Your time zone" value={mine} onChange={setMine} hint="Shown to your partner as your local time." />
        {couple ? (
          <>
            <TimezonePicker label="Couple day boundary" value={coupleTz} onChange={setCoupleTz} hint={`Today in this zone is ${todayKey(coupleTz)}.`} />
            <Banner kind="info" title="How the couple day works" body="The flame counts one day at a time in this single zone, so both of you share the same midnight. Daylight-saving changes are handled by the zone itself. If you change the zone, already-completed days keep their credit; only the current day is re-evaluated in the new zone, which can briefly reopen or close today." />
            <Txt variant="caption" tone="muted">
              Tip: pick the zone where most of your evenings happen, or the zone of whoever usually sends last.
            </Txt>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
