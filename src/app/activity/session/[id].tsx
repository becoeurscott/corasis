import { MotionPressable } from '@/components/ui/MotionPressable';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Banner, Button, Card, Chip, EmptyState, Header, Input, Screen, toast, Txt } from '@/components/ui';
import { deckById, questionById } from '@/data/questions';
import { haptic } from '@/lib/haptics';
import { backend, useData } from '@/services/backend';
import { useActivitySession, useCouple, useMe, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const reactions = ['❤️', '😂', '🥹', '😮', '🔥'];

/**
 * One screen covers the session lifecycle: answer → waiting → reveal.
 * The partner's answer is never in this component's data until reveal — the
 * backend redacts it (see docs/BACKEND.md for the server equivalent).
 */
export default function SessionScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useActivitySession(id);
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const profiles = useData((s) => s.profiles);
  const [answer, setAnswer] = useState(() => (session && me ? session.drafts?.[me.id] ?? '' : ''));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = (text: string) => {
    setAnswer(text);
    setError(null);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => session && backend.saveDraft(session.id, text), 500);
  };

  if (!session || !me) {
    return (
      <Screen>
        <Header title="Activity" />
        <EmptyState emoji="🫥" title="This activity is not available" body="It may have been closed, or it belongs to another couple." actionTitle="Back to Together" onAction={() => router.replace('/(tabs)/together')} />
      </Screen>
    );
  }
  const q = questionById(session.questionId)!;
  const deck = deckById(session.deckId);
  const mine = session.submissions.find((s) => s.userId === me.id);
  const isMC = !!q.options?.length;

  const submit = async (skipped = false) => {
    setBusy(true);
    setError(null);
    try {
      await backend.submit(session.id, answer, comment.trim() || null, skipped);
      haptic('success');
      if (skipped) toast('Skipped. No pressure.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const abandon = async () => {
    await backend.abandonSession(session.id);
    router.back();
  };

  const title = deck?.title ?? 'Activity';

  // ---------- Reveal ----------
  if (session.status === 'revealed') {
    const ordered = [...session.submissions].sort((a, b) => (a.userId === me.id ? -1 : b.userId === me.id ? 1 : 0));
    const agree = isMC && ordered.length === 2 && !ordered.some((s) => s.skipped) && ordered[0].answer === ordered[1].answer;
    const myReaction = session.reactions[me.id];
    return (
      <Screen footer={<><Button title="Next prompt" size="lg" onPress={() => router.replace(`/activity/${session.deckId}`)} /><Button title="Done" variant="ghost" onPress={() => router.replace('/(tabs)/together')} /></>}>
        <Header title={title} />
        <View style={{ gap: spacing.lg }}>
          <Card tint>
            <Txt variant="label" tone="primary">
              {q.type === 'would_you_rather' ? 'Would you rather' : 'Revealed'}
            </Txt>
            <Txt variant="heading">{q.type === 'would_you_rather' ? `${q.options![0]} or ${q.options![1]}?` : q.text}</Txt>
          </Card>
          {isMC && ordered.length === 2 ? <Banner kind={agree ? 'success' : 'info'} body={agree ? 'You picked the same thing.' : q.type === 'quiz' ? 'Different answers this time. Fun, not a verdict.' : 'You see it differently. Worth a conversation?'} /> : null}
          <View style={styles.side}>
            {ordered.map((s) => {
              const p = profiles[s.userId];
              return (
                <Card key={s.userId} style={{ flex: 1, gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Avatar name={p?.firstName ?? '?'} uri={p?.avatarUri} size={28} simulated={p?.isSimulated} />
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {s.userId === me.id ? 'You' : p?.firstName}
                    </Txt>
                  </View>
                  {s.skipped ? (
                    <Txt tone="muted">Skipped this one</Txt>
                  ) : (
                    <Txt>{s.answer}</Txt>
                  )}
                  {s.comment ? (
                    <Txt variant="caption" tone="secondary">
                      “{s.comment}”
                    </Txt>
                  ) : null}
                </Card>
              );
            })}
          </View>
          <Card style={{ gap: spacing.sm }}>
            <Txt variant="caption" tone="secondary" weight="600">
              React
            </Txt>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {reactions.map((r) => (
                <MotionPressable key={r} accessibilityRole="button" accessibilityLabel={`React ${r}`} accessibilityState={{ selected: myReaction === r }} onPress={() => { haptic('selection'); backend.react(session.id, r); }} style={[styles.reaction, { backgroundColor: myReaction === r ? colors.primarySoft : colors.surfaceTint, borderColor: myReaction === r ? colors.primary : 'transparent' }]}>
                  <Txt style={{ fontSize: 22 }}>{r}</Txt>
                </MotionPressable>
              ))}
            </View>
            {partner && session.reactions[partner.id] ? (
              <Txt variant="caption" tone="muted">
                {partner.firstName} reacted {session.reactions[partner.id]}
              </Txt>
            ) : null}
          </Card>
          <Txt variant="caption" tone="muted" center>
            Answers are locked after reveal so neither of you can quietly change them.
          </Txt>
        </View>
      </Screen>
    );
  }

  // ---------- Waiting ----------
  if (mine) {
    return (
      <Screen footer={<Button title="Back to Together" variant="secondary" onPress={() => router.replace('/(tabs)/together')} />}>
        <Header title={title} />
        <View style={{ gap: spacing.lg }}>
          <Card tint>
            <Txt variant="heading">{q.type === 'would_you_rather' ? `${q.options![0]} or ${q.options![1]}?` : q.text}</Txt>
          </Card>
          <EmptyState emoji="⏳" title={`Waiting for ${partner?.firstName ?? 'your partner'}`} body={partner?.isSimulated ? 'Your simulated partner usually answers within a few seconds.' : 'You will both see the answers as soon as they submit. We will nudge them gently, once.'} />
          <Card style={{ gap: 4 }}>
            <Txt variant="caption" tone="secondary" weight="600">
              Your answer
            </Txt>
            <Txt>{mine.skipped ? 'Skipped' : mine.answer}</Txt>
          </Card>
        </View>
      </Screen>
    );
  }

  // ---------- Answer ----------
  return (
    <Screen footer={<><Button title="Submit" size="lg" onPress={() => submit(false)} loading={busy} disabled={!answer.trim()} /><Button title="Skip this question" variant="ghost" onPress={() => submit(true)} /></>}>
      <Header title={title} right={<Button title="Close" variant="ghost" size="sm" full={false} onPress={abandon} />} />
      <View style={{ gap: spacing.lg }}>
        {!couple ? <Banner kind="warning" body="Not connected to a partner." /> : null}
        {session.status === 'waiting' ? <Banner kind="info" body={`${partner?.firstName ?? 'Your partner'} already answered. Theirs stays hidden until you submit.`} /> : null}
        <Card tint style={{ gap: spacing.xs }}>
          <Txt variant="label" tone="primary">
            {q.type === 'quiz' ? 'About your partner' : q.type === 'guess' ? 'Your prediction' : q.type === 'would_you_rather' ? 'Pick one' : 'Your turn'}
          </Txt>
          <Txt variant="title">{q.type === 'would_you_rather' ? 'Would you rather…' : q.text}</Txt>
          {q.aboutPartner && q.type === 'quiz' ? (
            <Txt variant="caption" tone="muted">
              {partner?.firstName ?? 'Your partner'} answers this about themselves.
            </Txt>
          ) : null}
        </Card>
        {isMC ? (
          <View style={{ gap: spacing.sm }}>
            {q.options!.map((o) => (
              <Chip key={o} label={o} selected={answer === o} onPress={() => saveDraft(o)} />
            ))}
          </View>
        ) : (
          <Input label="Your answer" value={answer} onChangeText={saveDraft} multiline placeholder="Take your time" maxLength={600} hint="Saved as a draft on this device while you type." />
        )}
        <Input label="Add a comment (optional)" value={comment} onChangeText={setComment} placeholder="Context, a joke, anything" maxLength={200} />
        {error ? <Banner kind="danger" body={error} /> : null}
        <Txt variant="caption" tone="muted">
          Your answer is sent to a protected endpoint and only revealed once both of you have submitted. You can skip anything that feels uncomfortable.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  side: { flexDirection: 'row', gap: spacing.md },
  reaction: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
