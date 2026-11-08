import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Keyboard, Share, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Input, toast, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useInvitations, useNow } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Invitation creation + code entry, reused by onboarding and settings. */
export function InvitePanel({ onPaired, compact = false }: { onPaired?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  const invitations = useInvitations();
  const now = useNow(60_000);
  const invite = invitations.length ? invitations[invitations.length - 1] : null;
  const [mode, setMode] = useState('invite');
  const [focused, setFocused] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof backend.previewInvitation>> | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      await backend.createInvitation();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const link = invite ? Linking.createURL(`/invite/${invite.code}`) : '';

  const share = async () => {
    if (!invite) return;
    try {
      await Share.share({ message: `Join me on Corasis. Open ${link} or enter the code ${invite.code}. It expires in 24 hours.` });
    } catch {
      await Clipboard.setStringAsync(link);
      toast('Link copied to clipboard');
    }
  };

  const lookup = async () => {
    Keyboard.dismiss(); setFocused(false);
    setError(null);
    setBusy(true);
    const p = await backend.previewInvitation(code);
    setPreview(p);
    setBusy(false);
    if (p.reason !== 'ok') {
      const msg: Record<string, string> = { invalid: 'That code is not valid.', expired: 'This invitation expired. Ask for a new one.', revoked: 'This invitation was cancelled.', used: 'This invitation was already used.', self: 'That is your own invitation.' };
      setError(msg[p.reason]);
    }
  };

  const accept = async () => {
    setBusy(true);
    try {
      await backend.acceptInvitation(code);
      toast('You are connected!', 'success');
      onPaired?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = invite ? { pending: 'Pending', accepted: 'Accepted', expired: 'Expired', revoked: 'Cancelled' }[invite.status] : '';
  const expiresIn = invite ? Math.max(0, Math.round((new Date(invite.expiresAt).getTime() - now.getTime()) / 3600_000)) : 0;

  return (
    <View style={{ gap: compact ? 8 : spacing.lg }}>
      {compact && !focused ? <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Invite" size="sm" style={{ flex: 1 }} variant={mode === 'invite' ? 'secondary' : 'ghost'} onPress={() => setMode('invite')} /><Button title="Enter code" size="sm" style={{ flex: 1 }} variant={mode === 'code' ? 'secondary' : 'ghost'} onPress={() => setMode('code')} /></View> : null}
      {!compact || mode === 'invite' ? <Card style={{ gap: compact ? 8 : spacing.md, ...(compact ? { padding: 12 } : {}) }}>
        <Txt variant="heading">Invite your partner</Txt>
        {invite && invite.status === 'pending' ? (
          <>
            <View style={[styles.code, compact && { paddingVertical: 8 }, { backgroundColor: colors.primarySoft }]}>
              <Txt accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`} style={{ fontSize: compact ? 28 : 34, fontWeight: '800', letterSpacing: 6, color: colors.primaryStrong }}>
                {invite.code}
              </Txt>
            </View>
            <Txt variant="caption" tone="muted" center>
              {statusLabel} · expires in about {expiresIn} h · single use
            </Txt>
            <Button title="Share invitation" onPress={share} size={compact ? 'sm' : 'md'} />
            {!compact ? <Button title="Copy link" variant="secondary" onPress={async () => { await Clipboard.setStringAsync(link); toast('Link copied'); }} /> : null}
            <Button title="Cancel invitation" size="sm" variant="ghost" onPress={() => backend.revokeInvitation(invite.id)} />
          </>
        ) : (
          <>
            {invite ? <Banner kind={invite.status === 'accepted' ? 'success' : 'warning'} body={`Your last invitation is ${statusLabel.toLowerCase()}.`} /> : <Txt tone="secondary">One code. Valid for 24 hours.</Txt>}
            <Button title="Create invitation" onPress={create} loading={busy} />
          </>
        )}
      </Card> : null}

      {!compact || mode === 'code' ? <Card style={{ gap: compact ? 8 : spacing.md, ...(compact ? { padding: 12 } : {}) }}>
        {!focused ? <Txt variant="heading">Have a code?</Txt> : null}
        <Input label={compact ? undefined : "Partner's code"} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} value={code} onChangeText={(v) => { setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setPreview(null); setError(null); }} autoCapitalize="characters" autoCorrect={false} placeholder="ABC123" error={error} onSubmitEditing={lookup} />
        {preview?.reason === 'ok' && preview.invitation ? (
          <Card tint style={{ gap: spacing.sm }}>
            <Txt variant="bodyStrong">Connect with {preview.invitation.inviterName}?</Txt>
            <Txt variant="caption" tone="secondary">
              Share moments and a calendar together.
            </Txt>
            <Button title={`Yes, connect with ${preview.invitation.inviterName}`} onPress={accept} loading={busy} />
          </Card>
        ) : (
          <Button title="Check code" variant="secondary" onPress={lookup} loading={busy} disabled={code.length < 6} />
        )}
      </Card> : null}
    </View>
  );
}

const styles = StyleSheet.create({ code: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center' } });
