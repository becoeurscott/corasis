import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'onPrimary' | 'danger' | 'success' | 'warning';

export interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
  weight?: TextStyle['fontWeight'];
}

export function Txt({ variant = 'body', tone = 'default', center, weight, style, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const color =
    tone === 'secondary' ? colors.textSecondary
    : tone === 'muted' ? colors.textMuted
    : tone === 'primary' ? colors.primary
    : tone === 'onPrimary' ? colors.onPrimary
    : tone === 'danger' ? colors.danger
    : tone === 'success' ? colors.success
    : tone === 'warning' ? colors.warning
    : colors.text;
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typeScale[variant], { color }, center && { textAlign: 'center' }, weight && { fontWeight: weight }, variant === 'label' && { textTransform: 'uppercase' }, style]}
    />
  );
}
