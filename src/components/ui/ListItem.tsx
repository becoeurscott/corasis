import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, touchTarget } from '@/theme/tokens';
import { Txt } from './Text';

type PressState = { pressed: boolean; focused?: boolean };

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  value?: string;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
  chevron?: boolean;
}

export function ListItem({ title, subtitle, icon, emoji, onPress, right, value, toggle, onToggle, danger, disabled, chevron = true }: ListItemProps) {
  const { colors } = useTheme();
  const isToggle = typeof toggle === 'boolean';
  const content = (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primaryStrong} />
        </View>
      ) : emoji ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceTint }]}>
          <Txt style={{ fontSize: 18 }}>{emoji}</Txt>
        </View>
      ) : null}
      <View style={styles.text}>
        <Txt variant="bodyStrong" tone={danger ? 'danger' : 'default'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="secondary">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="caption" tone="muted">
          {value}
        </Txt>
      ) : null}
      {right}
      {isToggle ? (
        <Switch
          accessibilityLabel={title}
          value={toggle}
          disabled={disabled}
          onValueChange={(v) => {
            haptic('selection');
            onToggle?.(v);
          }}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor="#fff"
        />
      ) : onPress && chevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </View>
  );
  if (onPress && !isToggle) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} disabled={disabled} onPress={onPress} style={({ pressed, focused }: PressState) => [pressed && { opacity: 0.7 }, focused && { backgroundColor: colors.selected }]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 56 }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget + 12, paddingVertical: spacing.sm },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
