import { MotionPressable } from '@/components/ui/MotionPressable';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Gradient, Txt } from '@/components/ui';
import { Baby } from '@/components/game/Baby';
import { ageDays, decayedNeeds, gameNow, moodOf, stageDef } from '@/lib/lifeGame';
import { useLifeGame } from '@/store/hooks';
import { radius, spacing } from '@/theme/tokens';

/** Shortcut to the baby game once both partners said yes (theme gradient, like the meeting card). */
export function BabyCard() {
  const game = useLifeGame();
  if (!game || (game.status !== 'naming' && game.status !== 'alive')) return null;
  const naming = game.status === 'naming';
  const day = Math.max(1, Math.floor(ageDays(game, gameNow(game))) + 1);
  const name = game.name ?? 'Your little one';
  const stage = stageDef(game.stage)?.label ?? 'Baby';
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={`${name}, ${naming ? 'choose a name together' : stage}. Open the baby game.`} onPress={() => router.push('/games/life')}>
      <Gradient style={{ borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View pointerEvents="none" style={{ width: 84, height: 84, borderRadius: 42, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ transform: [{ scale: 0.62 }, { translateY: 8 }] }}><Baby look={stageDef(game.stage).look} mood={naming ? 'happy' : moodOf(decayedNeeds(game, gameNow(game)))} size={150} /></View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label" style={{ color: 'rgba(255,255,255,0.9)' }}>Our little one</Txt>
          <Txt numberOfLines={1} style={{ color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '800' }}>{name}</Txt>
          <Txt style={{ color: 'rgba(255,255,255,0.92)' }}>{naming ? 'Choose a name together' : `${stage} · Day ${day} of 365`}</Txt>
        </View>
        <Txt style={{ color: 'rgba(255,255,255,0.8)', fontSize: 22 }}>›</Txt>
      </Gradient>
    </MotionPressable>
  );
}
