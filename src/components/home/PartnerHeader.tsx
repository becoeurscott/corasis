import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Txt } from '@/components/ui';
import { describeDifference, formatLocalTime, zoneDifferenceHours } from '@/lib/time';
import type { Profile } from '@/services/backend';
import { useNow } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function PartnerHeader({ me, partner }: { me: Profile; partner: Profile | null }) {
  const { colors } = useTheme();
  const now = useNow(15_000);
  const diff = partner ? zoneDifferenceHours(me.timezone, partner.timezone, now) : 0;
  return (
    <View style={styles.row}>
      <Person profile={me} now={now} label="You" />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={[styles.heart, { backgroundColor: colors.primarySoft }]}>
          <Txt style={{ fontSize: 18 }}>{partner ? '💞' : '🔗'}</Txt>
        </View>
        {partner ? (
          <Txt variant="caption" tone="muted" center>
            {describeDifference(diff)}
          </Txt>
        ) : null}
      </View>
      {partner ? (
        <Person profile={partner} now={now} label={partner.isSimulated ? 'Simulated' : 'Partner'} />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings/partner')} style={styles.person}>
          <View style={[styles.invite, { borderColor: colors.primary }]}>
            <Txt style={{ fontSize: 22 }}>＋</Txt>
          </View>
          <Txt variant="bodyStrong" tone="primary" center>
            Invite partner
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

function Person({ profile, now, label }: { profile: Profile; now: Date; label: string }) {
  return (
    <View style={styles.person}>
      <Avatar name={profile.firstName} uri={profile.avatarUri} size={64} simulated={profile.isSimulated} />
      <Txt variant="bodyStrong" center numberOfLines={1}>
        {profile.firstName}
      </Txt>
      <Txt variant="caption" tone="secondary" center>
        {formatLocalTime(now, profile.timezone)} · {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  person: { flex: 1, alignItems: 'center', gap: 4 },
  heart: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  invite: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
