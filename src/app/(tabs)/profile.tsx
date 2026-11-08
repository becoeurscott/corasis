import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Avatar, Banner, Button, Card, Divider, ListItem, Screen, SectionTitle, Txt } from '@/components/ui';
import { diffDays, todayKey } from '@/lib/time';
import { useCouple, useEntitlements, useMe, usePartner, useSession } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { palettes, spacing } from '@/theme/tokens';

export default function ProfileTab() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const session = useSession();
  const ent = useEntitlements();
  const theme = usePrefs((s) => s.theme);
  const appearance = usePrefs((s) => s.appearance);
  const language = usePrefs((s) => s.language);
  const lock = usePrefs((s) => s.appLockEnabled);
  if (!me) return null;
  const days = couple?.relationshipStart ? diffDays(couple.relationshipStart, todayKey(couple.coupleTimezone)) : null;

  return (
    <Screen edges={['top']}>
      <View style={{ gap: spacing.md }}>
        <Txt variant="title">Profile</Txt>
        <Card onPress={() => router.push('/settings/profile')} accessibilityLabel="Edit profile" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={me.firstName} uri={me.avatarUri} size={64} />
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{me.firstName}</Txt>
            <Txt variant="caption" tone="secondary">
              {me.pronouns ? `${me.pronouns} · ` : ''}{me.timezone.replace(/_/g, ' ')}
            </Txt>
            <Txt variant="caption" tone="muted">
              {session?.demo ? 'Demo account (local)' : session?.email}
            </Txt>
          </View>
        </Card>
        {session?.demo ? <Banner kind="demo" body="Demo mode: everything is stored on this device and the partner is simulated." /> : null}

        <SectionTitle title="Couple" />
        <Card>
          <ListItem icon="heart" title={partner ? `${me.firstName} & ${partner.firstName}` : 'Not connected'} subtitle={partner ? `${days != null ? `${days} days together` : 'Add your start date'}${partner.isSimulated ? ' · simulated partner' : ''}` : 'Invite your partner to pair'} onPress={() => router.push(partner ? '/settings/couple' : '/settings/partner')} />
          <Divider />
          <ListItem icon="link" title="Partner connection" subtitle="Invitations, unlink" onPress={() => router.push('/settings/partner')} />
          <Divider />
          <ListItem icon="calendar" title="Next meeting & calendar" onPress={() => router.push('/meetings')} />
          <Divider />
          <ListItem icon="phone-portrait" title="Widgets & wallpaper" onPress={() => router.push('/widgets')} />
        </Card>

        <SectionTitle title="Appearance" />
        <Card>
          <ListItem icon="color-palette" title="Theme" value={theme ? palettes[theme].label : ''} onPress={() => router.push('/settings/theme')} />
          <Divider />
          <ListItem icon="contrast" title="Light / dark" value={appearance === 'system' ? 'System' : appearance[0].toUpperCase() + appearance.slice(1)} onPress={() => router.push('/settings/theme')} />
          <Divider />
          <ListItem icon="language" title="Language" value={language === 'auto' ? 'Automatic' : language === 'fr' ? 'Français' : 'English'} onPress={() => router.push('/settings/language')} />
        </Card>

        <SectionTitle title="Preferences" />
        <Card>
          <ListItem icon="heart" title="Your connection preferences" subtitle="What feels right for you · private" onPress={() => router.push('/settings/connection')} />
          <Divider />
          <ListItem icon="time" title="Time zone & couple day" subtitle="When a day starts for the flame" onPress={() => router.push('/settings/timezone')} />
          <Divider />
          <ListItem icon="notifications" title="Notifications" subtitle="Categories, reminder time, quiet hours" onPress={() => router.push('/settings/notifications')} />
          <Divider />
          <ListItem icon="location" title="Location & battery sharing" onPress={() => router.push('/settings/sharing')} />
          <Divider />
          <ListItem icon="lock-closed" title="App lock" value={lock ? 'On' : 'Off'} onPress={() => router.push('/settings/lock')} />
          <Divider />
          <ListItem icon="sparkles" title="Together Plus" value={ent.premium ? 'Active (demo)' : 'Off'} onPress={() => router.push('/settings/premium')} />
        </Card>

        <SectionTitle title="Support & privacy" />
        <Card>
          <ListItem icon="help-circle" title="Help & FAQ" onPress={() => router.push('/settings/help')} />
          <Divider />
          <ListItem icon="shield-checkmark" title="Privacy policy & terms" onPress={() => router.push('/settings/privacy')} />
          <Divider />
          <ListItem icon="download" title="Your data" subtitle="Export, unlink, delete account" onPress={() => router.push('/settings/data')} />
        </Card>

        <Button title="Sign out" variant="ghost" onPress={() => router.push('/settings/data?signout=1')} />
        <Txt variant="caption" tone="muted" center>
          Together · v1.0 preview
        </Txt>
      </View>
    </Screen>
  );
}
