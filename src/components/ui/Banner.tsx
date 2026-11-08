import { MotionPressable } from '@/components/ui/MotionPressable';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Txt } from './Text';

type Kind = 'info' | 'warning' | 'danger' | 'success' | 'demo';

interface BannerProps {
  kind?: Kind;
  title?: string;
  body: string;
  actionTitle?: string;
  onAction?: () => void;
}

const icons: Record<Kind, string> = { info: 'ℹ️', warning: '⚠️', danger: '⛔', success: '✅', demo: '🧪' };

/** Status banner. Never relies on color alone: always carries an icon + text. */
export function Banner({ kind = 'info', title, body, actionTitle, onAction }: BannerProps) {
  const { colors } = useTheme();
  const bg = kind === 'warning' ? colors.warningSoft : kind === 'danger' ? colors.dangerSoft : kind === 'success' ? colors.successSoft : kind === 'demo' ? colors.primarySoft : colors.infoSoft;
  const fg = kind === 'warning' ? colors.warning : kind === 'danger' ? colors.danger : kind === 'success' ? colors.success : kind === 'demo' ? colors.primaryStrong : colors.info;
  return (
    <View accessibilityRole="alert" style={[styles.wrap, { backgroundColor: bg }]}>
      <Txt style={{ fontSize: 18, lineHeight: 24 }}>{icons[kind]}</Txt>
      <View style={styles.body}>
        {title ? (
          <Txt variant="bodyStrong" style={{ color: fg }}>
            {title}
          </Txt>
        ) : null}
        <Txt variant="caption" style={{ color: colors.text }}>
          {body}
        </Txt>
        {actionTitle && onAction ? (
          <MotionPressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
            <Txt variant="caption" weight="700" style={{ color: fg }}>
              {actionTitle} →
            </Txt>
          </MotionPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  body: { flex: 1, gap: 2 },
  action: { marginTop: spacing.xs, minHeight: 28, justifyContent: 'center' },
});
