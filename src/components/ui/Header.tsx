import { MotionPressable } from '@/components/ui/MotionPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing, touchTarget } from '@/theme/tokens';
import { Txt } from './Text';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
}

export function Header({ title, subtitle, back = true, onBack, right, large }: HeaderProps) {
  const { colors } = useTheme();
  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {back ? (
          <MotionPressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={8} style={[styles.btn, { backgroundColor: colors.surfaceTint }]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </MotionPressable>
        ) : (
          <View style={styles.btn} />
        )}
        {!large && title ? (
          <Txt variant="heading" center style={styles.flex} numberOfLines={1}>
            {title}
          </Txt>
        ) : (
          <View style={styles.flex} />
        )}
        <View style={[styles.right]}>{right ?? <View style={styles.btn} />}</View>
      </View>
      {large && title ? (
        <View style={{ gap: 4, marginTop: spacing.sm }}>
          <Txt variant="title" accessibilityRole="header">
            {title}
          </Txt>
          {subtitle ? <Txt tone="secondary">{subtitle}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { width: touchTarget, height: touchTarget, borderRadius: touchTarget / 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  right: { minWidth: touchTarget, alignItems: 'flex-end', justifyContent: 'center' },
});
