import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  footer?: React.ReactNode;
  keyboard?: boolean;
  alt?: boolean;
}

const MAX_WIDTH = 640;

/** Base screen: themed background, safe areas, optional scroll + sticky footer, keyboard avoidance. */
export function Screen({ children, scroll = true, padded = true, style, contentStyle, edges = ['top', 'bottom'], footer, keyboard = true, alt }: ScreenProps) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, styles.content, contentStyle]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, styles.content, contentStyle]}>{children}</View>
  );
  const inner = (
    <>
      {body}
      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: alt ? colors.backgroundAlt : colors.background }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: alt ? colors.backgroundAlt : colors.background }, style]}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  footerInner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: spacing.sm },
});
