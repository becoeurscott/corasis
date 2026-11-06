import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Banner, Button, Card, Header, Screen, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, useSession } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

/** Deep-link landing for together://invite/CODE. */
export default function InviteLanding() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const session = useSession();
  const couple = useCouple();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof backend.previewInvitation>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) backend.previewInvitation(code).then(setPreview);
  }, [code]);

  if (!session) {
    backend.setPendingInvite(code ?? null);
    return (
      <Screen>
        <Header title="Invitation" />
        <Banner kind="info" title="Sign in to accept" body="We saved this invitation. Create an account or sign in and it will be waiting for you." actionTitle="Continue" onAction={() => router.replace('/onboarding/theme')} />
      </Screen>
    );
  }

  const accept = async () => {
    setBusy(true);
    try {
      await backend.acceptInvitation(code!);
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reasonText: Record<string, string> = { invalid: 'This invitation link is not valid.', expired: 'This invitation has expired. Ask your partner for a new one.', revoked: 'Your partner cancelled this invitation.', used: 'This invitation was already used.', self: 'This is your own invitation. Share it with your partner instead.' };

  return (
    <Screen>
      <Header title="Invitation" />
      <View style={{ gap: spacing.lg }}>
        {couple ? <Banner kind="warning" title="Already connected" body="You are already in a couple. Unlink first from Profile if you need to pair with someone else." /> : null}
        {!preview ? <Txt tone="secondary">Checking invitation…</Txt> : preview.reason !== 'ok' ? <Banner kind="danger" body={reasonText[preview.reason]} /> : (
          <Card style={{ alignItems: 'center', gap: spacing.md }}>
            <Avatar name={preview.invitation!.inviterName} size={72} />
            <Txt variant="title" center>
              {preview.invitation!.inviterName} invited you
            </Txt>
            <Txt tone="secondary" center>
              Connecting links your accounts so you can share moments, answers and a calendar. Only two people can be in a couple.
            </Txt>
            {error ? <Banner kind="danger" body={error} /> : null}
            <Button title={`Connect with ${preview.invitation!.inviterName}`} onPress={accept} loading={busy} disabled={!!couple} />
            <Button title="Not now" variant="ghost" onPress={() => { backend.setPendingInvite(null); router.replace('/(tabs)'); }} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
