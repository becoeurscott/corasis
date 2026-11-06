import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { TimeField } from '@/components/TimeField';
import { Banner, Button, Card, Divider, Header, ListItem, Screen, SectionTitle, toast } from '@/components/ui';
import { requestNotificationPermission, scheduleDailyReminder } from '@/lib/notifications';
import { usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';

export default function NotificationSettings() {
  const n = usePrefs((s) => s.notifications);
  const set = usePrefs((s) => s.setNotifications);
  const [perm, setPerm] = useState<string | null>(null);
  const apply = async () => {
    const r = await requestNotificationPermission();
    setPerm(r);
    if (r === 'granted') {
      await scheduleDailyReminder();
      toast('Reminder scheduled', 'success');
    }
  };
  return (
    <Screen>
      <Header title="Notifications" />
      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Categories" />
        <Card>
          <ListItem icon="flame" title="Daily reminder" subtitle="One nudge to send your moment" toggle={n.dailyReminder} onToggle={(v) => set({ dailyReminder: v })} />
          <Divider />
          <ListItem icon="image" title="Partner moments" toggle={n.partnerMoments} onToggle={(v) => set({ partnerMoments: v })} />
          <Divider />
          <ListItem icon="chatbubbles" title="Activities & reveals" toggle={n.activities} onToggle={(v) => set({ activities: v })} />
          <Divider />
          <ListItem icon="heart" title="Messages & affection" toggle={n.messages} onToggle={(v) => set({ messages: v })} />
          <Divider />
          <ListItem icon="calendar" title="Meetings & dates" toggle={n.meetings} onToggle={(v) => set({ meetings: v })} />
        </Card>
        <SectionTitle title="Timing" />
        <Card style={{ gap: spacing.md }}>
          <TimeField label="Daily reminder time" value={n.reminderTime} onChange={(v) => set({ reminderTime: v })} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TimeField label="Quiet hours start" value={n.quietStart} onChange={(v) => set({ quietStart: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField label="Quiet hours end" value={n.quietEnd} onChange={(v) => set({ quietEnd: v })} />
            </View>
          </View>
          <Banner kind="info" body="Quiet hours use your local time. Affection and messages sent during your quiet hours arrive silently and show when you open the app. 'I need you' sends one gentle notification, never repeated alerts." />
        </Card>
        <SectionTitle title="Feedback" />
        <Card>
          <ListItem icon="volume-high" title="Sound" toggle={n.sound} onToggle={(v) => set({ sound: v })} />
          <Divider />
          <ListItem icon="phone-portrait" title="Haptics" toggle={n.haptics} onToggle={(v) => set({ haptics: v })} />
        </Card>
        {Platform.OS === 'web' ? <Banner kind="info" body="Notifications are only delivered by the mobile app. Preferences are saved and applied there." /> : <Button title="Apply & schedule on this device" variant="secondary" onPress={apply} />}
        {perm === 'denied' ? <Banner kind="warning" body="Notification permission is off in system Settings." /> : null}
      </View>
    </Screen>
  );
}
