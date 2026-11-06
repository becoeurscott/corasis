import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { Txt } from './Text';

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Txt variant="heading" accessibilityRole="header">
        {title}
      </Txt>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
          <Txt variant="caption" tone="primary" weight="700">
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  action: { minHeight: 32, justifyContent: 'center' },
});
