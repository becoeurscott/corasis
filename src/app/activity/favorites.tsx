import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card, EmptyState, Header, Screen, Txt } from '@/components/ui';
import { categoryMeta, decks, questionById } from '@/data/questions';
import { backend } from '@/services/backend';
import { useFavorites } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function Favorites() {
  const { colors } = useTheme();
  const favorites = useFavorites();
  return (
    <Screen>
      <Header title="Favorite questions" />
      {favorites.length ? (
        <View style={{ gap: spacing.sm }}>
          {favorites.map((id) => {
            const q = questionById(id);
            if (!q) return null;
            const deck = decks.find((d) => d.questionIds.includes(id));
            return (
              <Card key={id} onPress={() => deck && router.push(`/activity/${deck.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Txt>{q.text}</Txt>
                  <Txt variant="caption" tone="muted">
                    {categoryMeta[q.category].emoji} {categoryMeta[q.category].label}
                  </Txt>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove from favorites" onPress={() => backend.toggleFavorite(id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="star" size={22} color={colors.warning} />
                </Pressable>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState emoji="⭐" title="No favorites yet" body="Star a prompt inside any deck to keep it here." />
      )}
    </Screen>
  );
}
