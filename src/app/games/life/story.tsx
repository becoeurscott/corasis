import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, Header, Screen, SectionTitle, Txt } from '@/components/ui';
import { actionDef, life } from '@/lib/lifeGame';
import { relativeTime } from '@/lib/time';
import { useLifeGame, useMe, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Timeline of milestones, skills and who did what. */
export default function LifeStory() {
  const { colors } = useTheme();
  const game = useLifeGame();
  const me = useMe();
  const partner = usePartner();
  const [openedAt] = useState(() => Date.now());
  if (!game) {
    return (
      <Screen>
        <Header title="Their story" />
        <EmptyState emoji="📖" title="No story yet" body="Have a little one together to start writing it." />
      </Screen>
    );
  }
  const who = (id: string) => (id === me?.id ? 'You' : id === partner?.id ? `${partner.firstName}${partner.isSimulated ? ' (simulated)' : ''}` : 'Partner');
  const byParent = game.log.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.userId]: (acc[e.userId] ?? 0) + 1 }), {});
  return (
    <Screen>
      <Header title={game.name ? `${game.name}'s story` : 'Their story'} />
      <View style={{ gap: spacing.lg }}>
        {game.ending ? (
          <Card tint>
            <Txt variant="heading">{game.ending}</Txt>
          </Card>
        ) : null}

        <SectionTitle title="Who they became" />
        <View style={styles.skills}>
          {life.skills.map((s) => (
            <Card key={s.id} style={{ flexBasis: '45%', flexGrow: 1, alignItems: 'center', gap: 2 }}>
              <Txt style={{ fontSize: 24 }}>{s.emoji}</Txt>
              <Txt variant="bodyStrong">{s.label}</Txt>
              <Txt variant="caption" tone="muted">
                {game.skills[s.id]} pts
              </Txt>
            </Card>
          ))}
        </View>

        <SectionTitle title="Milestones" />
        <View>
          {game.milestones.map((m, i) => (
            <View key={m.id} style={styles.row}>
              <View style={{ alignItems: 'center', width: 18 }}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                {i < game.milestones.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.lg }}>
                <Txt variant="bodyStrong">{m.text}</Txt>
                <Txt variant="caption" tone="muted">
                  {new Date(m.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Txt>
              </View>
            </View>
          ))}
        </View>

        <SectionTitle title="Care together" />
        <Txt tone="secondary">{Object.keys(byParent).length ? Object.entries(byParent).map(([id, n]) => `${who(id)}: ${n}`).join(' · ') : 'No care yet.'}</Txt>
        {game.log.slice(0, 20).map((e) => (
          <Txt key={e.id} variant="caption" tone="secondary">
            {actionDef(e.actionId)?.emoji} {who(e.userId)} {actionDef(e.actionId)?.verb} {game.name} · {relativeTime(e.at, new Date(openedAt + game.clockOffsetMs))}
          </Txt>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  line: { width: 2, flex: 1, marginTop: 4 },
});
