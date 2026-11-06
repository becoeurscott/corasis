import React from 'react';
import { View } from 'react-native';

import { ThemePicker } from '@/components/ThemePicker';
import { Card, Chip, Header, ListItem, Screen, SectionTitle, Txt } from '@/components/ui';
import { AppearancePref, usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';

export default function ThemeSettings() {
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const appearance = usePrefs((s) => s.appearance);
  const setAppearance = usePrefs((s) => s.setAppearance);
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  return (
    <Screen>
      <Header title="Theme" />
      <View style={{ gap: spacing.md }}>
        <Txt tone="secondary">Your theme is yours alone; your partner picks their own.</Txt>
        <ThemePicker value={theme} onChange={setTheme} />
        <SectionTitle title="Appearance" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['system', 'light', 'dark'] as AppearancePref[]).map((a) => (
            <Chip key={a} label={a[0].toUpperCase() + a.slice(1)} selected={appearance === a} onPress={() => setAppearance(a)} />
          ))}
        </View>
        <Card>
          <ListItem icon="pulse" title="Reduce motion" subtitle="Shorter splash, no pulsing animations" toggle={reduceMotion} onToggle={(v) => usePrefs.setState({ reduceMotion: v })} />
        </Card>
      </View>
    </Screen>
  );
}
