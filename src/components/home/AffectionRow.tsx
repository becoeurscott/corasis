import { MotionPressable } from '@/components/ui/MotionPressable';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Sheet, toast, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { uid } from '@/lib/ids';
import { AffectionKind, backend } from '@/services/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export const affectionMeta: Record<AffectionKind, { emoji: string; label: string; sent: string }> = {
  kiss: { emoji: '😘', label: 'Kiss', sent: 'Kiss sent' },
  hug: { emoji: '🤗', label: 'Hug', sent: 'Hug sent' },
  thinking: { emoji: '💭', label: 'Thinking of you', sent: 'Sent: thinking of you' },
  need_you: { emoji: '🫶', label: 'I need you', sent: 'Sent: I need you' },
};

export function AffectionRow({ disabled }: { disabled?: boolean }) {
  const { colors } = useTheme();
  const [needOpen, setNeedOpen] = useState(false);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (kind: AffectionKind, ctx?: string) => {
    setBusy(true);
    try {
      await backend.sendMessage({ kind: 'affection', affection: kind, context: ctx?.trim() || null, clientRequestId: uid('req') });
      haptic('success');
      toast(affectionMeta[kind].sent, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      {(Object.keys(affectionMeta) as AffectionKind[]).map((k) => (
        <MotionPressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={`Send ${affectionMeta[k].label}`}
          disabled={disabled || busy}
          onPress={() => (k === 'need_you' ? setNeedOpen(true) : send(k))}
          style={() => [styles.item, { backgroundColor: colors.surfaceTint, opacity: disabled ? 0.5 : 1 }]}>
          <Txt style={{ fontSize: 26, lineHeight: 32 }}>{affectionMeta[k].emoji}</Txt>
          <Txt variant="caption" weight="600" center numberOfLines={2}>
            {affectionMeta[k].label}
          </Txt>
        </MotionPressable>
      ))}
      <Sheet visible={needOpen} onClose={() => setNeedOpen(false)} title="I need you">
        <Txt tone="secondary">This sends one gentle notification, not an alarm. Add a word or two if you want so they know what kind of support helps.</Txt>
        <Input value={context} onChangeText={setContext} placeholder="Optional: e.g. rough day, a call would help" maxLength={120} />
        <Button title="Send" onPress={async () => { setNeedOpen(false); await send('need_you', context); setContext(''); }} loading={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flex: 1, minHeight: 84, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 8 },
});
