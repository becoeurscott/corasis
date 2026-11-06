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
  const notif = usePrefs((s) => s.notifications);

  const finish = () => {
    haptic('success');
    backend.saveOnboarding({ completed: true, step: 8 });
    router.replace('/(tabs)');
  };

  return (
    <OnboardingFrame step="welcome" title={`You're set, ${me?.firstName ?? draft.firstName}`} subtitle="Here is what you chose. Everything can change later." onContinue={finish} continueTitle={couple ? 'Send my first moment' : 'Go to Home'}>
      <Card>
        <ListItem emoji="🎨" title="Theme" value={theme ? palettes[theme].label : '—'} chevron={false} />
        <ListItem emoji="👤" title="Name" value={me?.firstName ?? draft.firstName} chevron={false} />
        <ListItem emoji="🕒" title="Time zone" value={(me?.timezone ?? draft.timezone ?? '').replace(/_/g, ' ')} chevron={false} />
        <ListItem emoji="💞" title="Partner" value={partner ? `${partner.firstName}${partner.isSimulated ? ' (simulated)' : ''}` : 'Not connected yet'} chevron={false} />
        <ListItem emoji="⏰" title="Daily reminder" value={notif.dailyReminder ? notif.reminderTime : 'Off'} chevron={false} />
        <ListItem emoji="📍" title="Location sharing" value="Off (optional)" chevron={false} />
      </Card>
      <View style={{ marginTop: 16 }}>
        <Txt variant="caption" tone="muted" center>
          {couple ? 'Your first action: send one moment today. The flame starts when you both do.' : 'You can explore everything now and invite your partner from Profile whenever you like.'}
        </Txt>
      </View>
    </OnboardingFrame>
  );
}
