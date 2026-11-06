import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { TimeField } from '@/components/TimeField';
import { Banner, Button, Card, ListItem, Txt } from '@/components/ui';
import { requestNotificationPermission, scheduleDailyReminder } from '@/lib/notifications';
import { backend } from '@/services/backend';
import { usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';

export default function PrivacyStep() {
  const prefs = usePrefs((s) => s.notifications);
  const setNotifications = usePrefs((s) => s.setNotifications);
  const [perm, setPerm] = useState<'idle' | 'granted' | 'denied' | 'unavailable'>('idle');

  const ask = async () => {
    const r = await requestNotificationPermission();
    setPerm(r);
    if (r === 'granted') await scheduleDailyReminder();
  };

  const next = () => {
    backend.saveOnboarding({ step: 7 });
    router.push('/onboarding/welcome');
  };

  return (
    <OnboardingFrame step="privacy" title="Privacy and reminders" subtitle="You stay in control of what is shared." onContinue={next}>
      <View style={{ gap: spacing.lg }}>
        <Card tint style={{ gap: spacing.sm }}>
          <Txt variant="heading">Location and battery are off by default</Txt>
          <Txt tone="secondary">Sharing is optional, per person, and can be paused any time from the Map tab or Settings. Camera, microphone, photos and location permissions are only requested when you first use that feature.</Txt>
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="heading">Daily reminder</Txt>
          <Txt tone="secondary">A gentle nudge at a time you choose, so you remember to send your moment. Nothing fires during quiet hours.</Txt>
          <ListItem title="Remind me daily" toggle={prefs.dailyReminder} onToggle={(v) => setNotifications({ dailyReminder: v })} />
          <TimeField label="Reminder time" value={prefs.reminderTime} onChange={(v) => setNotifications({ reminderTime: v })} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TimeField label="Quiet from" value={prefs.quietStart} onChange={(v) => setNotifications({ quietStart: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField label="Until" value={prefs.quietEnd} onChange={(v) => setNotifications({ quietEnd: v })} />
            </View>
          </View>
          {perm === 'granted' ? <Banner kind="success" body="Notifications enabled. Your daily reminder is scheduled on this device." /> : perm === 'denied' ? <Banner kind="warning" body="Notifications are off. You can enable them later in system Settings." /> : perm === 'unavailable' || Platform.OS === 'web' ? <Banner kind="info" body="Push notifications need the mobile app. The browser preview cannot schedule reminders." /> : <Button title="Allow notifications" variant="secondary" onPress={ask} />}
        </Card>
      </View>
    </OnboardingFrame>
  );
}
