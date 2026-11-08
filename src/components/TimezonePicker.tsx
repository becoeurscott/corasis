import { MotionPressable } from '@/components/ui/MotionPressable';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Input, ListItem, Sheet, Txt } from '@/components/ui';
import { commonTimezones, formatLocalTime } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Props {
  label: string;
  value: string;
  onChange: (tz: string) => void;
  hint?: string;
}

function allZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const list = intl.supportedValuesOf?.('timeZone');
    if (list?.length) return list;
  } catch {
    /* fall through */
  }
  return commonTimezones;
}

export function TimezonePicker({ label, value, onChange, hint }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const zones = useMemo(() => {
    const all = allZones();
    const needle = q.trim().toLowerCase().replace(/\s+/g, '_');
    const filtered = needle ? all.filter((z) => z.toLowerCase().includes(needle)) : [...commonTimezones, ...all.filter((z) => !commonTimezones.includes(z))];
    return filtered.slice(0, 200);
  }, [q]);
  return (
    <View style={{ gap: spacing.xs }}>
      <Txt variant="caption" tone="secondary" weight="600">
        {label}
      </Txt>
      <MotionPressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{value.replace(/_/g, ' ')}</Txt>
          <Txt variant="caption" tone="muted">
            Local time now: {formatLocalTime(new Date(), value)}
          </Txt>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </MotionPressable>
      {hint ? (
        <Txt variant="caption" tone="muted">
          {hint}
        </Txt>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Time zone">
        <Input value={q} onChangeText={setQ} placeholder="Search e.g. Paris, Montreal" autoCapitalize="none" autoCorrect={false} />
        <FlatList keyboardDismissMode="on-drag"
          data={zones}
          keyExtractor={(z) => z}
          style={{ maxHeight: 380 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ListItem title={item.replace(/_/g, ' ')} value={formatLocalTime(new Date(), item)} chevron={false} onPress={() => { onChange(item); setOpen(false); setQ(''); }} right={item === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null} />
          )}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({ field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 56, gap: spacing.sm } });
