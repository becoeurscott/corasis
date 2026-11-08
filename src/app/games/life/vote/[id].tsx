import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { VotePanel } from '@/components/game/VotePanel';
import { Button, EmptyState, Header, Screen } from '@/components/ui';
import { useLifeGame } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function LifeVoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = useLifeGame();
  const vote = game?.votes.find((v) => v.id === id);
  return (
    <Screen>
      <Header title="Decide together" />
      {game && vote ? (
        <View style={{ gap: spacing.lg }}>
          <VotePanel game={game} vote={vote} />
          {vote.status === 'decided' ? <Button title={`Back to ${game.name ?? 'your little one'}`} onPress={() => router.replace('/games/life')} /> : null}
        </View>
      ) : (
        <EmptyState emoji="🗳️" title="Choice not found" body="This choice may already be settled." />
      )}
    </Screen>
  );
}
