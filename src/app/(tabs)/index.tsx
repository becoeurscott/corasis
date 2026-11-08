import { connectionRecommendation } from '@/lib/connectionPreferences';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { AffectionRow } from '@/components/home/AffectionRow';
import { CountdownCard } from '@/components/home/CountdownCard';
import { FlameCard } from '@/components/home/FlameCard';
import { PartnerHeader } from '@/components/home/PartnerHeader';
import { Avatar, Banner, Card, EmptyState, Screen, SectionTitle, Txt } from '@/components/ui';
import { dailyQuestionFor } from '@/data/questions';
import { nextMeeting } from '@/lib/events';
import { formatDistance, haversineKm } from '@/lib/geo';
import { isStale, relativeTime, todayKey } from '@/lib/time';
import { backend } from '@/services/backend';
import { useConnectionPreferences, useCouple, useDailySession, useEvents, useLive, useMe, useMessages, useMoments, usePartner, useSessions, useStreak } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function Home() {
  const { colors } = useTheme();
  const suggestion = connectionRecommendation(useConnectionPreferences());
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const moments = useMoments();
  const streak = useStreak();
  const events = useEvents();
  const messages = useMessages();
  const sessions = useSessions();
  const myLive = useLive(me?.id);
  const theirLive = useLive(partner?.id);
  const unit = usePrefs((s) => s.distanceUnit);
  const daily = useDailySession();
  const today = couple ? todayKey(couple.coupleTimezone) : todayKey(me?.timezone ?? 'UTC');
  useEffect(() => {
    if (couple) backend.dailySession();
  }, [couple, today]);

  if (!me) return null;

  const meeting = couple ? nextMeeting(events, couple.coupleTimezone) : null;
  const question = dailyQuestionFor(today);
  const partnerAnsweredDaily = !!daily && daily.status === 'waiting' && !daily.submissions.some((s) => s.userId === me.id);
  const iAnsweredDaily = !!daily && daily.submissions.some((s) => s.userId === me.id);
  const lastFromPartner = partner ? [...messages].reverse().find((m) => m.senderId === partner.id) : null;
  const distanceKm = myLive?.lat != null && myLive.lon != null && theirLive?.lat != null && theirLive.lon != null ? haversineKm(myLive.lat, myLive.lon, theirLive.lat, theirLive.lon) : null;
  const unansweredSessions = sessions.filter((s) => s.status === 'waiting' && !s.submissions.some((x) => x.userId === me.id)).length;

  return (
    <Screen edges={['top']}>
      <View style={{ gap: spacing.lg }}>
        <PartnerHeader me={me} partner={partner} />

        {!couple ? (
          <Card tint>
            <EmptyState compact emoji="🔗" title="Invite your partner to start the flame" body="You can explore activities and memories now. Pairing unlocks moments, answers and the shared calendar." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} />
          </Card>
        ) : null}

        {partner?.isSimulated ? <Banner kind="demo" body={`${partner.firstName} is a simulated partner. Replies are generated on this device and never reach a real person.`} /> : null}

        {couple && streak ? <FlameCard couple={couple} me={me} partner={partner} moments={moments} streak={streak} /> : null}

        {suggestion ? <Card onPress={() => router.push(`/activity/${suggestion.deck.id}`)} accessibilityLabel={suggestion.title} style={{ gap: spacing.sm }}>
          <Txt variant="label" tone="primary">{suggestion.title}</Txt><Txt variant="heading">{suggestion.deck.emoji} {suggestion.deck.title}</Txt><Txt tone="secondary">{suggestion.body}</Txt><Txt variant="caption" tone="muted">{suggestion.duration}</Txt>
        </Card> : null}
        {/* Contextual suggestions */}
        {partnerAnsweredDaily ? <Banner kind="info" title={`${partner?.firstName} answered today's question`} body="Answer yours to reveal both." actionTitle="Answer now" onAction={() => router.push('/activity/daily')} /> : null}
        {unansweredSessions > 0 && !partnerAnsweredDaily ? <Banner kind="info" body={`${partner?.firstName} is waiting on ${unansweredSessions} ${unansweredSessions === 1 ? 'answer' : 'answers'} from you.`} actionTitle="See activities" onAction={() => router.push('/activity/history')} /> : null}

        <CountdownCard meeting={meeting} />

        <Card onPress={() => router.push('/activity/daily')} accessibilityLabel="Question of the day" style={{ gap: spacing.sm }}>
          <Txt variant="label" tone="primary">
            Question of the day
          </Txt>
          <Txt variant="heading">{question.text}</Txt>
          <Txt variant="caption" tone="muted">
            {!couple ? 'Connect with your partner to answer together.' : iAnsweredDaily ? (daily?.status === 'revealed' ? 'Both answered · tap to see' : `Answered · waiting for ${partner?.firstName}`) : 'Tap to answer · hidden until you both do'}
          </Txt>
        </Card>

        <SectionTitle title="Quick affection" action="History" onAction={() => router.push('/messages')} />
        <AffectionRow disabled={!couple} />

        {lastFromPartner ? (
          <Card onPress={() => router.push('/messages')} accessibilityLabel="Latest message from partner" style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Avatar name={partner!.firstName} uri={partner!.avatarUri} size={40} simulated={partner!.isSimulated} />
            <View style={{ flex: 1 }}>
              <Txt variant="caption" tone="secondary">
                {partner!.firstName} · {relativeTime(lastFromPartner.createdAt)}
              </Txt>
              <Txt numberOfLines={2}>{lastFromPartner.kind === 'affection' ? `Sent you a ${lastFromPartner.affection?.replace('_', ' ')}` : lastFromPartner.kind === 'voice' ? '🎤 Voice note' : lastFromPartner.text}</Txt>
            </View>
          </Card>
        ) : null}

        {couple ? (
          <Card onPress={() => router.push('/(tabs)/map')} accessibilityLabel="Live info" style={{ gap: spacing.xs }}>
            <Txt variant="label" tone="primary">
              Live
            </Txt>
            {distanceKm != null ? (
              <Txt variant="heading">{formatDistance(distanceKm, unit)} apart</Txt>
            ) : (
              <Txt tone="secondary">Distance appears when you both share location. Yours is {myLive?.lat != null ? 'on' : 'off'}.</Txt>
            )}
            {theirLive?.batteryPercent != null ? (
              <Txt variant="caption" tone={isStale(theirLive.batteryUpdatedAt, 60) ? 'warning' : 'secondary'}>
                🔋 {partner?.firstName}: {theirLive.batteryPercent}% · {theirLive.batteryUpdatedAt ? relativeTime(theirLive.batteryUpdatedAt) : ''}{isStale(theirLive.batteryUpdatedAt, 60) ? ' (may be out of date)' : ''}
              </Txt>
            ) : (
              <Txt variant="caption" tone="muted">
                Battery is shown only when {partner?.firstName ?? 'your partner'} chooses to share it.
              </Txt>
            )}
          </Card>
        ) : null}
        <View style={{ height: spacing.xl }} />
        <Txt variant="caption" tone="muted" center style={{ color: colors.textMuted }}>
          Nothing here is a score. Skip anything that does not feel right today.
        </Txt>
      </View>
    </Screen>
  );
}
