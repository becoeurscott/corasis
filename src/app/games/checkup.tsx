import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Banner, Button, Card, Gradient, Header, ProgressBar, Screen, toast, Txt } from '@/components/ui';
import { checkup, checkupBand, checkupItemCount, checkupScore, guessPoints, type CheckupItem } from '@/data/checkup';
import { haptic } from '@/lib/haptics';
import { todayKey } from '@/lib/time';
import { backend, BackendError, type CheckupEntry } from '@/services/backend';
import { useCheckups, useCouple, useMe, usePartner } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

// Marriage Check-up: once a month each spouse rates 25 parts of the marriage in secret,
// guesses the other's score, then both reveal together. Mirrors native-ios/Together/Checkup.swift.

const GRADIENT: [string, string] = ['#F7A8C4', '#C2477A'];
type Phase = 'intro' | 'rating' | 'guessing';
type Row = { item: CheckupItem; me: number; them: number };

export default function CheckupScreen() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const entries = useCheckups();
  const partnerName = partner?.firstName ?? 'your spouse';
  const round = todayKey(couple?.coupleTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).slice(0, 7);
  const mine = entries.find((e) => e.round === round && e.userId === me?.id);
  const theirs = entries.find((e) => e.round === round && e.userId !== me?.id);

  let body: React.ReactNode;
  if (couple?.relationshipStage !== 'married') body = <Locked />;
  else if (mine && theirs) body = <Reveal mine={mine} theirs={theirs} partnerName={partnerName} />;
  else if (mine) body = <Waiting partnerName={partnerName} entries={entries} round={round} />;
  else body = <Play partnerName={partnerName} entries={entries} round={round} />;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Marriage Check-up" />
      {body}
    </Screen>
  );
}

function Locked() {
  return (
    <View style={{ gap: spacing.md }}>
      <Txt style={styles.bigEmoji} center>💍</Txt>
      <Txt variant="title">For married couples</Txt>
      <Txt tone="secondary">The Marriage Check-up is made for spouses. If you're married, set your relationship stage to Married in Settings → Couple, and it opens for both of you.</Txt>
    </View>
  );
}

function monthTitle(round: string) {
  const [y, m] = round.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function Play({ partnerName, entries, round }: { partnerName: string; entries: CheckupEntry[]; round: string }) {
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>('intro');
  const [ratings, setRatings] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState(60);
  const [busy, setBusy] = useState(false);
  const advancing = useRef(false);

  const pick = (value: number) => {
    if (advancing.current) return; // a fast double tap must not skip a question
    advancing.current = true;
    haptic('light');
    setRatings((r) => r.map((x, i) => (i === index ? value : x)));
    setTimeout(() => {
      if (index + 1 < checkupItemCount) setIndex(index + 1);
      else setPhase('guessing');
      advancing.current = false;
    }, 180);
  };

  const submit = async () => {
    const gap = ratings.indexOf(0);
    if (gap >= 0) { setIndex(gap); setPhase('rating'); return; }
    setBusy(true);
    try {
      await backend.submitCheckup(ratings, guess);
      haptic('success');
    } catch (e) {
      toast(e instanceof BackendError ? e.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'rating') {
    const item = checkup.items[index];
    return (
      <View style={{ gap: spacing.lg }}>
        <ProgressBar value={(index + 1) / checkupItemCount} label={`${index + 1} of ${checkupItemCount}`} />
        <Txt style={styles.bigEmoji} center>{item.emoji}</Txt>
        <Txt variant="title" center>{item.text}</Txt>
        <Txt tone="secondary" center>How happy are you with this?</Txt>
        <View style={{ gap: spacing.sm }}>
          {[5, 4, 3, 2, 1].map((v) => {
            const on = ratings[index] === v;
            return (
              <Pressable key={v} accessibilityRole="button" accessibilityLabel={`${v} of 5, ${checkup.scale[v - 1]}`} onPress={() => pick(v)}
                style={[styles.option, { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1 }]}>
                <Txt style={{ color: colors.primary, width: 90 }}>{'♥'.repeat(v)}</Txt>
                <Txt variant="bodyStrong">{checkup.scale[v - 1]}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Button title="Back" variant="ghost" onPress={() => (index === 0 ? setPhase('intro') : setIndex(index - 1))} />
      </View>
    );
  }

  if (phase === 'guessing') {
    return (
      <View style={{ gap: spacing.lg }}>
        <Txt style={styles.bigEmoji} center>🔮</Txt>
        <Txt variant="title" center>Guess {partnerName}'s score</Txt>
        <Txt tone="secondary" center>How happy do you think {partnerName} is with your marriage this month, out of 100?</Txt>
        <View style={styles.stepper}>
          <Button title="−5" variant="secondary" full={false} onPress={() => setGuess((g) => Math.max(0, g - 5))} />
          <Txt style={[styles.guess, { color: colors.primary }]}>{guess}%</Txt>
          <Button title="+5" variant="secondary" full={false} onPress={() => setGuess((g) => Math.min(100, g + 5))} />
        </View>
        <Button title="Lock in my answers" loading={busy} onPress={submit} />
        <Button title="Back to the questions" variant="ghost" onPress={() => { setIndex(checkupItemCount - 1); setPhase('rating'); }} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Gradient colors={GRADIENT} style={styles.hero}>
        <Txt style={styles.bigEmoji}>💍</Txt>
        <Txt variant="title" style={{ color: '#fff' }}>This month's check-up</Txt>
        <Txt style={{ color: 'rgba(255,255,255,0.85)' }}>{monthTitle(round)}</Txt>
      </Gradient>
      <Card style={{ gap: spacing.md }}>
        <Rule n="1" text={`Rate 25 parts of your marriage, from 1 to 5. ${partnerName} can't see your answers.`} />
        <Rule n="2" text={`Guess the score ${partnerName} will give.`} />
        <Rule n="3" text="When you've both finished, reveal together: your scores, where you agree, and what to talk about." />
      </Card>
      <Banner body={checkup.disclaimer} />
      <Button title="Start" onPress={() => { setRatings(Array(checkupItemCount).fill(0)); setIndex(0); setPhase('rating'); }} />
      <History entries={entries} round={round} />
    </View>
  );
}

function Rule({ n, text }: { n: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={[styles.ruleNum, { backgroundColor: colors.primarySoft }]}><Txt variant="bodyStrong" style={{ color: colors.primary }}>{n}</Txt></View>
      <Txt style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

function Waiting({ partnerName, entries, round }: { partnerName: string; entries: CheckupEntry[]; round: string }) {
  const me = useMe();
  const partner = usePartner();
  return (
    <View style={{ gap: spacing.lg }}>
      <Txt style={styles.bigEmoji} center>⏳</Txt>
      <Txt variant="title" center>Your answers are locked in</Txt>
      <Txt tone="secondary" center>Waiting for {partnerName} to finish. The reveal opens as soon as you've both answered.</Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <Avatar name={me?.firstName ?? ''} uri={me?.avatarUri ?? null} size={56} />
        <View style={{ marginLeft: -12, opacity: 0.45 }}><Avatar name={partnerName} uri={partner?.avatarUri ?? null} size={56} /></View>
      </View>
      <History entries={entries} round={round} />
    </View>
  );
}

function History({ entries, round }: { entries: CheckupEntry[]; round: string }) {
  const { colors } = useTheme();
  const byRound = new Map<string, CheckupEntry[]>();
  for (const e of entries) if (e.round !== round) byRound.set(e.round, [...(byRound.get(e.round) ?? []), e]);
  const past = [...byRound.entries()].filter(([, v]) => v.length === 2).sort(([a], [b]) => b.localeCompare(a));
  if (!past.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="heading">Past months</Txt>
      <Card style={{ gap: spacing.sm }}>
        {past.map(([r, v]) => {
          const avg = Math.floor((checkupScore(v[0].ratings) + checkupScore(v[1].ratings)) / 2);
          return (
            <View key={r} style={styles.row}>
              <Txt style={{ flex: 1 }}>{monthTitle(r)}</Txt>
              <Txt variant="caption" tone="secondary">{checkupBand(avg).title}</Txt>
              <Txt variant="bodyStrong" style={{ color: colors.primary }}>{avg}%</Txt>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function Reveal({ mine, theirs, partnerName }: { mine: CheckupEntry; theirs: CheckupEntry; partnerName: string }) {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const [showAll, setShowAll] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }).start(); }, [fade]);

  const myScore = checkupScore(mine.ratings);
  const theirScore = checkupScore(theirs.ratings);
  const average = Math.floor((myScore + theirScore) / 2);
  const band = checkupBand(average);
  const rows: Row[] = checkup.items.map((item, i) => ({ item, me: mine.ratings[i], them: theirs.ratings[i] }));
  const inTune = rows.filter((r) => Math.abs(r.me - r.them) <= 1).length;
  const strengths = rows.filter((r) => r.me >= 4 && r.them >= 4).sort((a, b) => b.me + b.them - (a.me + a.them)).slice(0, 3);
  const talkAbout = rows
    .filter((r) => Math.abs(r.me - r.them) >= 2 || r.me + r.them <= 5)
    .sort((a, b) => Math.abs(b.me - b.them) - Math.abs(a.me - a.them) || a.me + a.them - (b.me + b.them))
    .slice(0, 3);

  return (
    <Animated.View style={{ gap: spacing.lg, opacity: fade }}>
      <Gradient colors={GRADIENT} style={styles.hero}>
        <View style={{ flexDirection: 'row', gap: 28 }}>
          <Bubble name={me?.firstName ?? ''} uri={me?.avatarUri ?? null} score={myScore} label="You" />
          <Bubble name={partnerName} uri={partner?.avatarUri ?? null} score={theirScore} label={partnerName} />
        </View>
        <Txt style={styles.average}>{average}%</Txt>
        <Txt variant="heading" style={{ color: '#fff' }}>{band.title}</Txt>
        <Txt center style={{ color: 'rgba(255,255,255,0.9)' }}>{band.text}</Txt>
      </Gradient>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat value={`${inTune}/25`} label="in tune" />
        <Stat value={`${guessPoints(mine.guess, theirScore)}`} label="your guess pts" />
        <Stat value={`${guessPoints(theirs.guess, myScore)}`} label={`${partnerName}'s pts`} />
      </View>
      <Card style={{ gap: spacing.sm }}>
        <Txt variant="bodyStrong">🔮 Guesses</Txt>
        <Txt>You guessed {mine.guess}%, {partnerName} gave {theirScore}%.</Txt>
        <Txt>{partnerName} guessed {theirs.guess}%, you gave {myScore}%.</Txt>
      </Card>
      {strengths.length ? <RowList title="💪 Going great" rows={strengths} partnerName={partnerName} /> : null}
      {talkAbout.length ? <RowList title="💬 Worth talking about" rows={talkAbout} partnerName={partnerName} /> : null}
      <Pressable accessibilityRole="button" onPress={() => setShowAll((v) => !v)}>
        <Txt variant="bodyStrong" center style={{ color: colors.primary }}>{showAll ? 'Hide all answers' : 'See all 25 answers'}</Txt>
      </Pressable>
      {showAll ? <RowList title="All answers" rows={rows} partnerName={partnerName} /> : null}
      <Banner body={checkup.disclaimer} />
    </Animated.View>
  );
}

function Bubble({ name, uri, score, label }: { name: string; uri: string | null; score: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Avatar name={name} uri={uri} size={52} />
      <Txt variant="bodyStrong" style={{ color: '#fff' }}>{score}%</Txt>
      <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{label}</Txt>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Txt variant="heading" style={{ color: colors.primary }}>{value}</Txt>
      <Txt variant="caption" tone="secondary" numberOfLines={1} adjustsFontSizeToFit>{label}</Txt>
    </View>
  );
}

function RowList({ title, rows, partnerName }: { title: string; rows: Row[]; partnerName: string }) {
  const { colors } = useTheme();
  const hearts = (n: number) => '♥'.repeat(n) + '♡'.repeat(5 - n);
  return (
    <Card style={{ gap: spacing.md }}>
      <Txt variant="bodyStrong">{title}</Txt>
      {rows.map((r) => (
        <View key={r.item.id} style={styles.row}>
          <Txt>{r.item.emoji}</Txt>
          <Txt style={{ flex: 1 }}>{r.item.text}</Txt>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="caption" style={{ color: colors.primary }}><Txt variant="caption" tone="secondary">You </Txt>{hearts(r.me)}</Txt>
            <Txt variant="caption" style={{ color: colors.primary }}><Txt variant="caption" tone="secondary">{partnerName.slice(0, 8)} </Txt>{hearts(r.them)}</Txt>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  bigEmoji: { fontSize: 64, lineHeight: 76 },
  hero: { borderRadius: 28, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  guess: { fontSize: 56, lineHeight: 64, fontWeight: '800', minWidth: 140, textAlign: 'center' },
  ruleNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  average: { fontSize: 64, lineHeight: 72, fontWeight: '900', color: '#fff' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 18, gap: 4 },
});
