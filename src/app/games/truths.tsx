import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Banner, Card, Gradient, Header, ProgressBar, Screen, toast, Txt } from '@/components/ui';
import { truths, truthsItemCount, type TruthItem } from '@/data/truths';
import { haptic } from '@/lib/haptics';
import { todayKey } from '@/lib/time';
import { backend, BackendError, type TruthsEntry } from '@/services/backend';
import { useCouple, useMe, usePartner, useTruths } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

// Five Truths: 5 deep questions. Each partner answers and guesses the other's answer,
// then both reveal together. Once a month. Mirrors native-ios/Together/Truths.swift.

const GRADIENT: [string, string] = ['#B9A4FF', '#7C5CFF'];

export default function TruthsScreen() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const entries = useTruths();
  const partnerName = partner?.firstName ?? 'your partner';
  const round = todayKey(couple?.coupleTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).slice(0, 7);
  const mine = entries.find((e) => e.round === round && e.userId === me?.id);
  const theirs = entries.find((e) => e.round === round && e.userId !== me?.id);

  let body: React.ReactNode;
  if (mine && theirs) body = <Reveal mine={mine} theirs={theirs} partnerName={partnerName} />;
  else if (mine) body = <Waiting partnerName={partnerName} />;
  else body = <Play partnerName={partnerName} />;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Five Truths" />
      {body}
    </Screen>
  );
}

// ---------- Intro + Play ----------

function Play({ partnerName }: { partnerName: string }) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [guessing, setGuessing] = useState(false);
  const [forward, setForward] = useState(true);
  const popAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(popAnim, { toValue: 1, damping: 8, stiffness: 100, useNativeDriver: true }).start();
  }, [popAnim]);

  const start = useCallback(() => {
    setAnswers(Array(truthsItemCount).fill(-1));
    setGuesses(Array(truthsItemCount).fill(-1));
    setIndex(0);
    setGuessing(false);
    setForward(true);
    setPlaying(true);
  }, []);

  if (!playing) return <Intro onStart={start} popAnim={popAnim} />;
  return (
    <Question
      index={index}
      guessing={guessing}
      forward={forward}
      answers={answers}
      guesses={guesses}
      partnerName={partnerName}
      onChoose={(i) => {
        haptic('light');
        if (guessing) {
          const g = [...guesses]; g[index] = i; setGuesses(g);
        } else {
          const a = [...answers]; a[index] = i; setAnswers(a);
        }
        setTimeout(() => {
          setForward(true);
          if (!guessing) {
            setGuessing(true);
          } else if (index + 1 < truthsItemCount) {
            setGuessing(false);
            setIndex(index + 1);
          } else {
            submit(answers, guesses.map((v, j) => j === index ? i : v));
          }
        }, 220);
      }}
      onBack={() => {
        setForward(false);
        if (guessing) setGuessing(false);
        else if (index > 0) { setIndex(index - 1); setGuessing(true); }
        else setPlaying(false);
      }}
    />
  );
}

async function submit(answers: number[], guesses: number[]) {
  try {
    await backend.submitTruths(answers, guesses);
    haptic('success');
  } catch (e) {
    toast((e as BackendError).message ?? 'Something went wrong');
  }
}

// ---------- Intro ----------

function Intro({ onStart, popAnim }: { onStart: () => void; popAnim: Animated.Value }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Gradient colors={GRADIENT} style={styles.hero}>
        <Animated.Text style={[styles.heroEmoji, { transform: [{ scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotate: popAnim.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) }] }]}>🗝️</Animated.Text>
        <Txt variant="title" style={{ color: '#FFF', textAlign: 'center' }}>Five Truths</Txt>
        <Txt style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>5 questions for life</Txt>
      </Gradient>
      <Card><Txt>{truths.intro}</Txt></Card>
      <Pressable accessibilityRole="button" onPress={onStart}>
        <Gradient colors={GRADIENT} style={styles.primaryBtn}>
          <Txt style={{ color: '#FFF', fontWeight: '700', fontSize: 17 }}>Start</Txt>
        </Gradient>
      </Pressable>
    </View>
  );
}

// ---------- Question ----------

function QuestionCard({ item, step, guessing, partnerName }: { item: TruthItem; step: number; guessing: boolean; partnerName: string }) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const popAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(0);
    popAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }),
      Animated.spring(popAnim, { toValue: 1, damping: 8, stiffness: 100, useNativeDriver: true, delay: 100 }),
    ]).start();
  }, [step, slideAnim, popAnim]);

  return (
    <Animated.View style={[styles.questionCard, { backgroundColor: guessing ? colors.surface : colors.surface, opacity: slideAnim, transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
      <Animated.Text style={[styles.cardEmoji, { transform: [{ scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: popAnim.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '0deg'] }) }] }]}>{item.emoji}</Animated.Text>
      <Txt variant="heading" style={{ textAlign: 'center', fontWeight: '700' }}>{item.text}</Txt>
      <Txt tone="secondary" style={{ textAlign: 'center', fontWeight: '600', fontSize: 14 }}>
        {guessing ? `What will ${partnerName} answer?` : 'Your honest answer'}
      </Txt>
    </Animated.View>
  );
}

function RiseIn({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true, delay: index * 60 }).start();
  }, [anim, index]);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Question({ index, guessing, forward, answers, guesses, partnerName, onChoose, onBack }: {
  index: number; guessing: boolean; forward: boolean; answers: number[]; guesses: number[]; partnerName: string;
  onChoose: (i: number) => void; onBack: () => void;
}) {
  const { colors } = useTheme();
  const item = truths.items[index];
  const step = index * 2 + (guessing ? 1 : 0);
  const picked = guessing ? guesses[index] : answers[index];

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ProgressBar value={(step + 1) / (truthsItemCount * 2)} />
      <Txt tone="secondary" style={{ textAlign: 'center', fontWeight: '700', fontSize: 12 }}>Question {index + 1} of {truthsItemCount}</Txt>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <QuestionCard key={step} item={item} step={step} guessing={guessing} partnerName={partnerName} />
      </View>
      <View style={{ gap: 10 }}>
        {item.options.map((option, i) => (
          <RiseIn key={`${step}-${i}`} index={i}>
            <Pressable accessibilityRole="button" onPress={() => onChoose(i)} style={[styles.option, { backgroundColor: picked === i ? colors.surface : colors.surface, borderColor: picked === i ? GRADIENT[1] : colors.border, borderWidth: picked === i ? 2 : 1 }]}>
              <Txt style={{ fontWeight: '600', flex: 1 }}>{option}</Txt>
              {picked === i && <Txt style={{ color: GRADIENT[1], fontWeight: '700' }}>✓</Txt>}
            </Pressable>
          </RiseIn>
        ))}
      </View>
      <Pressable onPress={onBack} style={{ alignSelf: 'center', padding: 12 }}>
        <Txt tone="secondary" style={{ fontWeight: '600' }}>Back</Txt>
      </Pressable>
    </View>
  );
}

// ---------- Waiting ----------

function Waiting({ partnerName }: { partnerName: string }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ])).start();
  }, [pulse]);
  return (
    <View style={[styles.page, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.Text style={[{ fontSize: 64 }, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>🔐</Animated.Text>
      <Txt variant="title" style={{ textAlign: 'center' }}>Your truths are locked in</Txt>
      <Txt tone="secondary" style={{ textAlign: 'center' }}>Waiting for {partnerName}. The reveal opens as soon as you've both answered.</Txt>
    </View>
  );
}

// ---------- Reveal ----------

function Reveal({ mine, theirs, partnerName }: { mine: TruthsEntry; theirs: TruthsEntry; partnerName: string }) {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const [shown, setShown] = useState(0);

  const same = mine.answers.reduce((c, a, i) => c + (a === theirs.answers[i] ? 1 : 0), 0);
  const myRight = mine.guesses.reduce((c, g, i) => c + (g === theirs.answers[i] ? 1 : 0), 0);
  const theirRight = theirs.guesses.reduce((c, g, i) => c + (g === mine.answers[i] ? 1 : 0), 0);

  useEffect(() => {
    truths.items.forEach((_, i) => {
      setTimeout(() => setShown((s) => Math.max(s, i + 1)), 300 + i * 350);
    });
  }, []);

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Gradient colors={GRADIENT} style={[styles.hero, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', gap: -10 }}>
          {me && <Avatar name={me.firstName} uri={me.avatarUri} size={48} />}
          {partner && <Avatar name={partner.firstName} uri={partner.avatarUri} size={48} />}
        </View>
        <Txt style={{ color: '#FFF', fontSize: 52, fontWeight: '800' }}>{same}/{truthsItemCount}</Txt>
        <Txt style={{ color: '#FFF', fontWeight: '700', fontSize: 18 }}>
          {same >= 4 ? 'Same page' : same >= 2 ? 'Worth a talk' : 'Time for a real conversation'}
        </Txt>
        <Txt style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>answers you share</Txt>
      </Gradient>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatBox value={`${myRight}/5`} label={`you read ${partnerName}`} />
        <StatBox value={`${theirRight}/5`} label={`${partnerName} read you`} />
      </View>
      {truths.items.map((item, i) => i < shown && (
        <RevealRow key={item.id} item={item} mine={mine} theirs={theirs} index={i} partnerName={partnerName} />
      ))}
      <Banner title="💬" body={truths.talk} />
    </View>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
      <Txt style={{ fontWeight: '700', fontSize: 18, color: GRADIENT[1] }}>{value}</Txt>
      <Txt tone="secondary" style={{ fontSize: 12 }} numberOfLines={1}>{label}</Txt>
    </View>
  );
}

function RevealRow({ item, mine, theirs, index, partnerName }: { item: TruthItem; mine: TruthsEntry; theirs: TruthsEntry; index: number; partnerName: string }) {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const a = mine.answers[index];
  const b = theirs.answers[index];
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Txt style={{ fontSize: 22 }}>{item.emoji}</Txt>
        <Txt style={{ fontWeight: '700', fontSize: 14, flex: 1 }}>{item.text}</Txt>
      </View>
      <AnswerLine person={me} name="You" answer={item.options[a]} guessedRight={theirs.guesses[index] === a} />
      <AnswerLine person={partner} name={partnerName} answer={item.options[b]} guessedRight={mine.guesses[index] === b} />
      {a !== b && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Txt style={{ color: GRADIENT[1], fontWeight: '700', fontSize: 12 }}>💬 Talk about this one</Txt>
        </View>
      )}
    </Card>
  );
}

function AnswerLine({ person, name, answer, guessedRight }: { person: { firstName: string; avatarUri?: string | null } | null; name: string; answer: string; guessedRight: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      {person && <Avatar name={person.firstName} uri={person.avatarUri} size={28} />}
      <View style={{ flex: 1 }}>
        <Txt tone="secondary" style={{ fontSize: 11 }}>{name}</Txt>
        <Txt style={{ fontWeight: '600', fontSize: 14 }}>{answer}</Txt>
      </View>
      {guessedRight && <Txt style={{ fontSize: 14 }}>🎯</Txt>}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  page: { flex: 1, padding: spacing.md, gap: 16 },
  hero: { borderRadius: 28, padding: 24, alignItems: 'center', gap: 10 },
  heroEmoji: { fontSize: 64 },
  primaryBtn: { borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  questionCard: { borderRadius: 26, padding: 22, alignItems: 'center', gap: 14, shadowColor: '#7C5CFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  cardEmoji: { fontSize: 60 },
  option: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15, flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
});
