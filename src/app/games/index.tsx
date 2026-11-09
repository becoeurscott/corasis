import { MotionPressable } from '@/components/ui/MotionPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Gradient, toast, Txt } from '@/components/ui';
import { Game, games, gameTags } from '@/data/games';
import { haptic } from '@/lib/haptics';
import { choiceDef, currentVote, decayedNeeds, gameNow, moodOf } from '@/lib/lifeGame';
import { useLifeGame, useMe, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** The hero stays dark in every theme so the colored game cards pop, like a game launcher. */
const HERO_BG = '#15101A';
const MAX_WIDTH = 640;

function openGame(game: Game) {
  haptic('light');
  if (game.status === 'coming_soon') toast(`${game.title} is coming soon`);
  else if (game.id === 'our_little_one') router.push('/games/life');
  else if (game.id === 'marriage_checkup') router.push('/games/checkup');
}

function Tag({ label, light }: { label: string; light?: boolean }) {
  return (
    <View style={[styles.tag, { backgroundColor: light ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)' }]}>
      <Txt variant="label" style={{ color: '#FFFFFF', fontSize: 10, letterSpacing: 0.8 }}>
        {label.toUpperCase()}
      </Txt>
    </View>
  );
}

function HeroCard({ game, width }: { game: Game; width: number }) {
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={`${game.title}. ${game.tagline}. ${game.status === 'coming_soon' ? 'Coming soon' : ''}`} onPress={() => openGame(game)} style={{ width }}>
      <Gradient colors={game.colors} style={[styles.hero]}>
        <Txt style={styles.heroEmoji} accessibilityElementsHidden importantForAccessibility="no">
          {game.emoji}
        </Txt>
        <View style={styles.heroTop}>
          {game.tags.map((t) => (
            <Tag key={t} label={t} light />
          ))}
        </View>
        <View style={{ gap: 6 }}>
          {game.status === 'coming_soon' ? (
            <View style={styles.soon}>
              <View style={styles.soonDot} />
              <Txt variant="label" style={{ color: '#FFFFFF', fontSize: 10 }}>
                COMING SOON
              </Txt>
            </View>
          ) : null}
          <Txt style={styles.heroTitle} numberOfLines={2}>
            {game.title.toUpperCase()}
          </Txt>
          <Txt style={styles.heroMeta}>
            {game.players} · {game.pace}
          </Txt>
        </View>
        <View style={styles.play}>
          <Ionicons name="play" size={22} color={game.colors[1]} style={{ marginLeft: 3 }} />
        </View>
      </Gradient>
    </MotionPressable>
  );
}

export default function GamesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const me = useMe();
  const partner = usePartner();
  const life = useLifeGame();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const contentWidth = Math.min(windowWidth, MAX_WIDTH);
  const cardWidth = contentWidth - spacing.lg * 2;
  const partnerName = partner?.firstName ?? 'your partner';

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (!selected.length || selected.some((t) => g.tags.includes(t))) &&
          (!q || `${g.title} ${g.tagline} ${g.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [selected, q],
  );

  const toggle = (t: string) => setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + spacing.md)));

  return (
    <View style={[styles.flex, { backgroundColor: HERO_BG }]}>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Hero */}
        <View style={[styles.column, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.header}>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/together'))} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </MotionPressable>
            <Txt variant="label" style={{ color: 'rgba(255,255,255,0.7)', flex: 1, textAlign: 'center' }}>
              {me && partner ? `${me.firstName.toUpperCase()} & ${partner.firstName.toUpperCase()}` : 'GAMES'}
            </Txt>
            <View style={styles.pair}>
              {me ? <Avatar name={me.firstName} uri={me.avatarUri} size={30} /> : null}
              {partner ? (
                <View style={{ marginLeft: -10 }}>
                  <Avatar name={partner.firstName} uri={partner.avatarUri} size={30} simulated={partner.isSimulated} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md }}>
            <Txt style={styles.kicker}>Play together</Txt>
            <Txt style={styles.headline}>Games for two</Txt>
          </View>

          <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + spacing.md}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {games.map((g) => (
              <HeroCard key={g.id} game={g} width={cardWidth} />
            ))}
          </ScrollView>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {games.map((g, i) => (
              <View key={g.id} style={[styles.dot, i === page && { width: 18, backgroundColor: '#FFFFFF' }]} />
            ))}
          </View>
        </View>

        {/* Sheet */}
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={[styles.column, { paddingHorizontal: spacing.lg, gap: spacing.lg }]}>
            <View style={styles.exploreRow}>
              <Txt variant="display" style={{ flex: 1 }}>
                Explore
              </Txt>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={searching ? 'Close search' : 'Search games'}
                onPress={() => {
                  setSearching((s) => !s);
                  if (searching) setQ('');
                }}
                hitSlop={8}
                style={[styles.roundBtn, { backgroundColor: colors.surfaceTint }]}>
                <Ionicons name={searching ? 'close' : 'search'} size={18} color={colors.text} />
              </MotionPressable>
              {selected.length ? (
                <MotionPressable accessibilityRole="button" accessibilityLabel={`${selected.length} filters selected. Clear`} onPress={() => setSelected([])} style={[styles.selectedPill, { borderColor: colors.border }]}>
                  <Txt variant="caption" weight="600">
                    {selected.length} selected
                  </Txt>
                  <Ionicons name="close" size={12} color={colors.textMuted} />
                </MotionPressable>
              ) : null}
            </View>

            {searching ? (
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder="Search games"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                style={[styles.search, { backgroundColor: colors.surfaceTint, color: colors.text, borderColor: colors.border }]}
              />
            ) : null}

            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ marginHorizontal: -spacing.lg }}>
              <View style={{ width: spacing.lg - spacing.sm }} />
              {gameTags.map((t) => {
                const on = selected.includes(t);
                return (
                  <MotionPressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      haptic('selection');
                      toggle(t);
                    }}
                    style={[styles.filter, { backgroundColor: on ? colors.primary : colors.primarySoft }]}>
                    <Txt variant="label" style={{ color: on ? colors.onPrimary : colors.primaryStrong, fontSize: 11 }}>
                      {t.toUpperCase()}
                    </Txt>
                  </MotionPressable>
                );
              })}
              <View style={{ width: spacing.lg - spacing.sm }} />
            </ScrollView>

            {/* Your turn */}
            <View style={{ gap: spacing.sm }}>
              <Txt variant="heading">Your turn</Txt>
              {life && life.status !== 'ended' ? (
                <MotionPressable accessibilityRole="button" onPress={() => router.push('/games/life')} style={[styles.turnCard, { backgroundColor: colors.backgroundAlt }]}>
                  <Gradient colors={games[0].colors} style={styles.turnThumb}>
                    <Txt style={{ fontSize: 22, textAlign: 'center', lineHeight: 44 }}>👶</Txt>
                  </Gradient>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{life.name ?? 'Our Little One'}</Txt>
                    <Txt variant="caption" tone="secondary">
                      {(() => {
                        const v = currentVote(life);
                        if (life.status === 'proposed') return life.proposedBy === me?.id ? `Waiting for ${partnerName} to say yes` : `${partnerName} wants a baby with you 💞`;
                        if (v && me && !v.picks[me.id]) return `Your vote: ${choiceDef(v.choice).title.toLowerCase()}`;
                        if (life.status === 'naming') return `Waiting for ${partnerName} to pick a name`;
                        const mood = moodOf(decayedNeeds(life, gameNow(life)));
                        return mood === 'happy' ? 'Happy and growing' : mood === 'sad' ? 'Needs you now: needs are low' : `Needs care: ${mood}`;
                      })()}
                    </Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </MotionPressable>
              ) : (
                <View style={[styles.turnCard, { backgroundColor: colors.backgroundAlt }]}>
                  <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">No games in progress</Txt>
                    <Txt variant="caption" tone="secondary">
                      Start Our Little One and you&apos;ll see here what {partnerName} and your child need.
                    </Txt>
                  </View>
                </View>
              )}
            </View>

            {/* All games */}
            <View style={{ gap: spacing.md }}>
              <Txt variant="heading">All games</Txt>
              {filtered.map((g) => (
                <MotionPressable key={g.id} accessibilityRole="button" accessibilityLabel={`${g.title}. ${g.tagline}`} onPress={() => openGame(g)} style={styles.row}>
                  <Gradient colors={g.colors} style={styles.thumb}>
                    <Txt style={{ fontSize: 28, textAlign: 'center', lineHeight: 64 }}>{g.emoji}</Txt>
                  </Gradient>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {g.title}
                    </Txt>
                    <Txt variant="caption" tone="secondary" numberOfLines={1}>
                      {g.tagline}
                    </Txt>
                    <View style={styles.rowMeta}>
                      <View style={[styles.statusDot, { backgroundColor: g.status === 'available' ? colors.success : colors.warning }]} />
                      <Txt variant="caption" tone="muted" numberOfLines={1}>
                        {g.status === 'available' ? 'Play now' : 'Coming soon'} · {g.pace}
                      </Txt>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </MotionPressable>
              ))}
              {!filtered.length ? (
                <Txt tone="muted" center>
                  No games match that search.
                </Txt>
              ) : null}
            </View>

            {/* Scoreboard */}
            <View style={{ gap: spacing.md }}>
              <Txt variant="heading">Scoreboard</Txt>
              <View style={[styles.score, { backgroundColor: colors.backgroundAlt }]}>
                <View style={styles.player}>
                  <View style={[styles.ring, { borderColor: games[0].colors[1] }]}>
                    <Avatar name={me?.firstName ?? 'You'} uri={me?.avatarUri} size={52} />
                  </View>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {me?.firstName ?? 'You'}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    0 wins
                  </Txt>
                </View>
                <Txt variant="title" tone="muted">
                  vs
                </Txt>
                <View style={styles.player}>
                  <View style={[styles.ring, { borderColor: games[3].colors[1] }]}>
                    <Avatar name={partner?.firstName ?? '?'} uri={partner?.avatarUri} size={52} simulated={partner?.isSimulated} />
                  </View>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {partner?.firstName ?? 'Partner'}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {partner?.isSimulated ? 'Simulated · 0 wins' : '0 wins'}
                  </Txt>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  pair: { flexDirection: 'row', minWidth: 36, justifyContent: 'flex-end' },
  kicker: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  headline: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  hero: { height: 320, borderRadius: radius.xl, padding: spacing.xl, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroEmoji: { position: 'absolute', right: -18, top: 40, fontSize: 170, lineHeight: 200, opacity: 0.35, transform: [{ rotate: '-12deg' }] },
  heroTitle: { color: '#FFFFFF', fontSize: 36, lineHeight: 38, fontWeight: '900', letterSpacing: 0.5, maxWidth: '80%' },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  soonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  play: { position: 'absolute', right: spacing.xl, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg, marginBottom: spacing.xxl + spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  sheet: { flexGrow: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -spacing.xl, paddingTop: spacing.xl },
  exploreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, paddingHorizontal: 12, height: 32, borderRadius: radius.pill },
  search: { height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 16 },
  filter: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, justifyContent: 'center' },
  turnCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  turnThumb: { width: 44, height: 44, borderRadius: 14 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  score: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: spacing.lg, borderRadius: radius.lg },
  player: { alignItems: 'center', gap: 4, flex: 1 },
  ring: { padding: 3, borderRadius: 40, borderWidth: 3 },
});
