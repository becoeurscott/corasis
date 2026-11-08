import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { OnboardingFrame } from '@/components/OnboardingFrame';
import { TimeField } from '@/components/TimeField';
import { Button, Card, ListItem, Txt } from '@/components/ui';
import { requestNotificationPermission, scheduleDailyReminder } from '@/lib/notifications';
import { backend } from '@/services/backend';
import { usePrefs } from '@/store/prefs';

export default function PrivacyStep() {
  const prefs = usePrefs(s => s.notifications);
  const setNotifications = usePrefs(s => s.setNotifications);
  const [notice, setNotice] = useState('');
  const ask = async () => { const result = await requestNotificationPermission(); if (result === 'granted') { await scheduleDailyReminder(); setNotice('Reminder enabled.'); } else setNotice('You can enable reminders in Settings.'); };
  const next = () => { backend.saveOnboarding({ step: 7 }); router.push('/onboarding/welcome'); };
  return <OnboardingFrame step="privacy" title="Your space. Your choice." subtitle="Sharing stays off until you choose it." onContinue={next}>
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 14 }}><Txt variant="caption">Location & battery sharing: off.</Txt></Card>
      <Card style={{ padding: 14, gap: 8 }}>
        <ListItem title="Daily reminder" toggle={prefs.dailyReminder} onToggle={value => setNotifications({ dailyReminder: value })} />
        {prefs.dailyReminder ? <TimeField label="What time?" value={prefs.reminderTime} onChange={value => setNotifications({ reminderTime: value })} /> : null}
        {prefs.dailyReminder && Platform.OS !== 'web' ? <Button title="Enable reminders" size="sm" variant="secondary" onPress={ask} /> : null}
        <Txt variant="caption" tone="muted">{notice || (Platform.OS === 'web' ? 'Reminders need the mobile app.' : 'Quiet hours apply. Edit anytime in Settings.')}</Txt>
      </Card>
    </View>
  </OnboardingFrame>;
}
