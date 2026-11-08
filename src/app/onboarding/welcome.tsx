import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Card, ListItem, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { backend } from '@/services/backend';
import { useCouple, useMe, useOnboarding, usePartner } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { palettes } from '@/theme/tokens';

export default function WelcomeStep() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const draft = useOnboarding();
  const theme = usePrefs((s) => s.theme);

  const finish = () => {
    haptic('success');
    backend.saveOnboarding({ completed: true, step: 8 });
    router.replace('/(tabs)');
  };

  return (
    <OnboardingFrame step="welcome" title={`You're set, ${me?.firstName ?? draft.firstName}`} subtitle="Your little space is ready." onContinue={finish} continueTitle={couple ? 'Send my first moment' : 'Go to Home'}>
      <Card>
        <ListItem emoji="🎨" title="Theme" value={theme ? palettes[theme].label : '—'} chevron={false} />
        <ListItem emoji="👤" title="Name" value={me?.firstName ?? draft.firstName} chevron={false} />
        <ListItem emoji="💞" title="Partner" value={partner ? `${partner.firstName}${partner.isSimulated ? ' (demo)' : ''}` : 'Invite later'} chevron={false} />
      </Card>
      <View style={{ marginTop: 16 }}>
        <Txt variant="caption" tone="muted" center>
          {couple ? 'Start with one small moment.' : 'Explore now. Invite your partner later.'}
        </Txt>
      </View>
    </OnboardingFrame>
  );
}
