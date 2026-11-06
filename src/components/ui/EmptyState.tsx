import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Txt } from './Text';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ emoji = '✨', title, body, actionTitle, onAction, compact }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && { paddingVertical: spacing.lg }]}>
      <Txt style={{ fontSize: compact ? 28 : 40, lineHeight: compact ? 34 : 48 }}>{emoji}</Txt>
      <Txt variant="heading" center>
        {title}
      </Txt>
      {body ? (
        <Txt tone="secondary" center>
          {body}
        </Txt>
      ) : null}
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} full={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg } });
