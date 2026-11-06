import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { previewTheme, useTheme } from '@/theme/ThemeProvider';
import { palettes, radius, spacing, ThemeName, themeOrder } from '@/theme/tokens';

type PressState = { pressed: boolean; focused?: boolean };

interface Props {
  value: ThemeName | null;
  onChange: (t: ThemeName) => void;
}

/** Four large swatches with live preview, name and checkmark. */
export function ThemePicker({ value, onChange }: Props) {
  const { appearance, colors } = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {themeOrder.map((name) => {
        const t = previewTheme(name, appearance);
        const selected = value === name;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={`${palettes[name].label} theme. ${palettes[name].tagline}`}
            onPress={() => {
              haptic('selection');
              onChange(name);
            }}
            style={({ pressed, focused }: PressState) => [
              styles.card,
              { backgroundColor: t.colors.surface, borderColor: selected ? t.colors.primary : colors.border, borderWidth: selected ? 3 : 1 },
              focused && { borderColor: t.colors.focus, borderWidth: 3 },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}>
            <View style={[styles.preview, { backgroundColor: t.colors.gradientEnd }]}>
              <View style={[styles.blob, { backgroundColor: t.colors.gradientStart }]} />
              <View style={[styles.miniCard, { backgroundColor: t.colors.surface }]}>
                <View style={[styles.miniLine, { backgroundColor: t.colors.text, width: '60%' }]} />
                <View style={[styles.miniLine, { backgroundColor: t.colors.textMuted, width: '40%' }]} />
                <View style={[styles.miniPill, { backgroundColor: t.colors.primary }]} />
              </View>
            </View>
            <View style={styles.footer}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" style={{ color: t.colors.text }}>
                  {palettes[name].label}
                </Txt>
                <Txt variant="caption" style={{ color: t.colors.textSecondary }}>
                  {palettes[name].tagline}
                </Txt>
              </View>
              <View style={[styles.check, { backgroundColor: selected ? t.colors.primary : t.colors.surfaceTint, borderColor: t.colors.border }]}>
                {selected ? <Ionicons name="checkmark" size={16} color={t.colors.onPrimary} /> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { width: '47.5%', minWidth: 150, flexGrow: 1, borderRadius: radius.lg, overflow: 'hidden' },
  preview: { height: 120, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -90, left: -40, opacity: 0.8 },
  miniCard: { width: '70%', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 10, gap: 6 },
  miniLine: { height: 6, borderRadius: 3 },
  miniPill: { height: 12, width: '50%', borderRadius: 6, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
