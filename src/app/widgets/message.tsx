import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Gradient, Header, Input, Screen, toast, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, usePartner, useWidgetMessage } from '@/store/hooks';
import { radius, spacing } from '@/theme/tokens';

/** Composer for the short message shown on the partner's widget. */
export default function WidgetMessageComposer() {
  const couple = useCouple();
  const partner = usePartner();
  const current = useWidgetMessage();
  const [text, setText] = useState('');

  const save = async () => {
    try {
      await backend.setWidgetMessage(text);
      toast(`Widget message updated for ${partner?.firstName ?? 'your partner'}`, 'success');
      router.back();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Screen footer={<Button title="Update widget" size="lg" onPress={save} disabled={!text.trim() || !couple} />}>
      <Header title="Widget message" />
      <View style={{ gap: spacing.lg }}>
        <Txt tone="secondary">A short line that appears on {partner?.firstName ?? 'your partner'}'s home screen. Keep it sweet; 80 characters max.</Txt>
        <Input label="Message" value={text} onChangeText={setText} maxLength={80} placeholder={current?.text ?? 'e.g. 23 days. Counting.'} hint={`${text.length}/80`} />
        <Gradient style={{ borderRadius: radius.lg, padding: spacing.lg, minHeight: 120, justifyContent: 'center' }}>
          <Txt variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Preview
          </Txt>
          <Txt variant="title" style={{ color: '#fff' }}>
            {text || current?.text || 'Your message here'}
          </Txt>
        </Gradient>
        <Banner kind="info" body="Delivery: the message is saved to the shared widget store. On a device, the partner's widget refreshes when the OS allows, typically within 15–30 minutes, or on the next app open." />
        {!couple ? <Banner kind="warning" body="Connect with your partner to send widget messages." /> : null}
      </View>
    </Screen>
  );
}
