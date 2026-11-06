import React from 'react';

import { Banner, Card, Chip, Header, ListItem, Screen, Txt } from '@/components/ui';
import { DistanceUnit, usePrefs } from '@/store/prefs';
import { spacing } from '@/theme/tokens';
import { View } from 'react-native';

export default function LanguageSettings() {
  const language = usePrefs((s) => s.language);
  const setLanguage = usePrefs((s) => s.setLanguage);
  const unit = usePrefs((s) => s.distanceUnit);
  const setUnit = usePrefs((s) => s.setDistanceUnit);
  return (
    <Screen>
      <Header title="Language & units" />
      <View style={{ gap: spacing.lg }}>
        <Card>
          <ListItem title="English" chevron={false} onPress={() => setLanguage('en')} right={<Txt tone="primary">{language === 'en' ? '✓' : ''}</Txt>} />
          <ListItem title="Français" chevron={false} onPress={() => setLanguage('fr')} right={<Txt tone="primary">{language === 'fr' ? '✓' : ''}</Txt>} />
        </Card>
        <Banner kind="info" body="French translation covers the navigation and key labels so far; the rest of the interface falls back to English. The string catalog lives in src/lib/i18n.ts." />
        <Txt variant="caption" tone="secondary" weight="600">
          Distance units
        </Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['km', 'mi'] as DistanceUnit[]).map((u) => (
            <Chip key={u} label={u === 'km' ? 'Kilometers' : 'Miles'} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
