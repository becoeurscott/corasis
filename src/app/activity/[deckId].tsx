import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Banner, Button, Card, EmptyState, Header, Screen, SectionTitle, toast, Txt } from '@/components/ui';
import { categoryMeta, deckById, questionById } from '@/data/questions';
import { backend } from '@/services/backend';
import { useCouple, useEntitlements, useFavorites, useSessions } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const typeHelp: Record<string, string> = {
  daily_question: 'Answer in your own words. Hidden until you both submit.',
  quiz: "Guess about your partner; they answer about themselves. Scores are for fun.",
  would_you_rather: 'Pick one option each. See if you agree.',
  guess: "Predict your partner's answer, then compare side by side.",
  photo_challenge: 'Both send a photo for the prompt. It also counts as a moment.',
  deck: 'Open-ended prompts to answer separately and reveal together.',
};

export default function DeckDetail() {
  const { colors } = useTheme();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const deck = deckById(deckId ?? '');
  const couple = useCouple();
  const ent = useEntitlements();
  const favorites = useFavorites();
  const sessions = useSessions();
  const [showAll, setShowAll] = useState(false);

  if (!deck) {
    return (
      <Screen>
        <Header title="Deck" />
        <EmptyState emoji="🃏" title="Deck not found" />
      </Screen>
    );
  }
  const locked = deck.premium && !ent.premium;
  const played = new Set(sessions.filter((s) => s.deckId === deck.id && s.status === 'revealed').map((s) => s.questionId));
  const open = sessions.find((s) => s.deckId === deck.id && (s.status === 'in_progress' || s.status === 'waiting'));
  const nextQ = deck.questionIds.find((id) => !played.has(id)) ?? deck.questionIds[0];

  const start = async (qid: string) => {
    if (!couple) return toast('Connect with your partner to play together.', 'error');
    if (locked) return router.push('/settings/premium');
    const q = questionById(qid)!;
    if (q.type === 'photo_challenge') return router.push({ pathname: '/flame/capture', params: { challenge: q.text } });
    const s = await backend.startSession(deck.id, qid);
    router.push(`/activity/session/${s.id}`);
  };

  return (
    <Screen footer={<Button title={open ? 'Resume session' : locked ? 'Unlock with Together Plus' : 'Start'} size="lg" onPress={() => (open ? router.push(`/activity/session/${open.id}`) : start(nextQ))} />}>
      <Header title={deck.title} />
      <View style={{ gap: spacing.lg }}>
        <Card tint style={{ alignItems: 'center', gap: spacing.sm }}>
          <Txt style={{ fontSize: 48, lineHeight: 56 }}>{deck.emoji}</Txt>
          <Txt variant="title" center>
            {deck.title}
          </Txt>
          <Txt tone="secondary" center>
            {deck.description}
          </Txt>
          <Txt variant="caption" tone="muted">
            {categoryMeta[deck.category].emoji} {categoryMeta[deck.category].label} · {deck.questionIds.length} prompts · {played.size} played
          </Txt>
        </Card>
        <Card style={{ gap: 4 }}>
          <Txt variant="label" tone="primary">
            How it works
          </Txt>
          <Txt>{typeHelp[deck.type]}</Txt>
          <Txt variant="caption" tone="muted">
            Either of you can skip any prompt. Answers lock once revealed.
          </Txt>
        </Card>
        {locked ? <Banner kind="info" title="Together Plus deck" body="This deck is part of the optional Plus set. The demo lets you toggle Plus in Settings; nothing is charged." actionTitle="See Plus" onAction={() => router.push('/settings/premium')} /> : null}
        {!couple ? <Banner kind="warning" body="Connect with your partner to play. You can preview the prompts below." /> : null}

        <SectionTitle title="Preview" action={showAll ? 'Show fewer' : 'Show all'} onAction={() => setShowAll(!showAll)} />
        <View style={{ gap: spacing.sm }}>
          {(showAll ? deck.questionIds : deck.questionIds.slice(0, 4)).map((id) => {
            const q = questionById(id)!;
            const fav = favorites.includes(id);
            return (
              <Card key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Pressable accessibilityRole="button" accessibilityLabel={q.text} onPress={() => start(id)} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                  <Txt>{q.options && q.type === 'would_you_rather' ? `${q.options[0]}  or  ${q.options[1]}?` : q.text}</Txt>
                  {played.has(id) ? (
                    <Txt variant="caption" tone="success">
                      Played ✓
                    </Txt>
                  ) : null}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'} hitSlop={8} onPress={() => backend.toggleFavorite(id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color={fav ? colors.warning : colors.textMuted} />
                </Pressable>
              </Card>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
