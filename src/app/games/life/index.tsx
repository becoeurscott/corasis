import { useAnim } from '@/components/game/useAnim';
import { MotionPressable } from "@/components/ui/MotionPressable";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Baby, BabyHandle } from "@/components/game/Baby";
import {
  burst,
  Effects,
  particle,
  ParticleSpec,
} from "@/components/game/Effects";
import { Room, RoomHandle } from "@/components/game/Room";
import * as sfx from "@/components/game/sound";
import { tiers, FeelTier } from "@/components/game/feel";
import { Button, Gradient, toast, Txt } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import {
  LifeActionDef,
  actionDef,
  ageDays,
  choiceDef,
  currentVote,
  decayedNeeds,
  fill,
  gameNow,
  growthProgress,
  life,
  LifeMood,
  moodOf,
  pendingChoice,
  stageActions,
  stageDef,
} from "@/lib/lifeGame";
import { relativeTime } from "@/lib/time";
import {
  backend,
  BackendError,
  LifeGame,
  LifeStageId,
} from "@/services/backend";
import { useLifeGame, useMe, usePartner, useSession } from "@/store/hooks";
import { radius, spacing } from "@/theme/tokens";

/** A soft room behind the character for each age, independent of the app theme. */
const scenes: Record<LifeStageId, [string, string]> = {
  newborn: ["#DCEEFF", "#A9CFFF"],
  toddler: ["#FFF1C9", "#FFC98A"],
  child: ["#D7F5E6", "#8FD9B6"],
  teen: ["#E6DEFF", "#A99BFF"],
  adult: ["#DDF3FA", "#86C9E3"],
  partnered: ["#FFE2E8", "#FF9FB5"],
  elder: ["#F3EBDD", "#D2BFA0"],
};
const INK = "#2B1E2F";

const moodLine: Record<LifeMood, string> = {
  happy: "is happy and content",
  hungry: "is hungry",
  sleepy: "is getting sleepy",
  dirty: "needs a bath",
  bored: "wants to play",
  lonely: "misses you",
  sad: "feels neglected and has stopped growing",
};

function NeedChip({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: number;
}) {
  const low = value < 35;
  const pop = useAnim(1);
  const prev = useRef(value);
  // Pop the meter with an overshoot when it fills up, so care visibly lands on the HUD.
  useEffect(() => {
    const old = prev.current;
    prev.current = value;
    if (value <= old + 0.5) return;
    pop.setValue(1.35);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start();
  }, [value, pop]);
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${Math.round(value)} percent`}
      style={styles.need}
    >
      <Animated.View
        style={[
          { transform: [{ scale: pop }] },
          styles.needIcon,
          { borderColor: low ? "#E5484D" : "rgba(43,30,47,0.12)" },
        ]}
      >
        <Txt style={{ fontSize: 18 }}>{emoji}</Txt>
      </Animated.View>
      <View style={styles.needTrack}>
        <View
          style={{
            width: `${value}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: low
              ? "#E5484D"
              : value < 60
                ? "#F2A33A"
                : "#3DBE7A",
          }}
        />
      </View>
    </View>
  );
}

const ROOM_H = 400;
const BABY_BOTTOM = 34;
type Pose = "feed" | "bathe" | "sleep" | null;
const poseOf: Record<string, Pose> = {
  feed: "feed",
  bathe: "bathe",
  sleep: "sleep",
};
const fx: Record<string, string[]> = {
  cuddle: ["❤️", "💕", "💗"],
  talk: ["💬", "🔤", "✨"],
  homework: ["✏️", "⭐", "📝"],
  hobby: ["🎵", "🎶", "✨"],
  chat: ["💬", "😂", "💭"],
  work: ["💼", "💰", "⭐"],
  date: ["💕", "🌹", "✨"],
  stories: ["📖", "✨", "🌟"],
};
/** Food grows up with the child. */
const foodFor = (stage: LifeStageId) =>
  stage === "newborn"
    ? "🍼"
    : stage === "toddler"
      ? "🥣"
      : stage === "elder"
        ? "🍵"
        : stage === "child"
          ? "🍎"
          : "🍝";

/** A care item you can drag onto the child (or tap). It springs back if you miss. */
function DragItem({
  a,
  emoji,
  disabled,
  onStart,
  onMove,
  onDrop,
}: {
  a: LifeActionDef;
  emoji: string;
  disabled: boolean;
  onStart: () => void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number, tapped: boolean) => boolean;
}) {
  const pan = useState(() => new Animated.ValueXY())[0];
  const lift = useAnim(0);
  const cb = useRef({ onStart, onMove, onDrop, disabled });
  useEffect(() => {
    cb.current = { onStart, onMove, onDrop, disabled };
  });
  const back = () =>
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        useNativeDriver: false,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  // The handlers read the latest callbacks from the ref only when a gesture fires, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !cb.current.disabled,
      onMoveShouldSetPanResponder: () => !cb.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        haptic("light");
        cb.current.onStart();
        Animated.timing(lift, {
          toValue: 1,
          duration: 120,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: (_e, g) => {
        pan.setValue({ x: g.dx, y: g.dy });
        cb.current.onMove(g.moveX, g.moveY);
      },
      onPanResponderRelease: (_e, g) => {
        const tapped = Math.abs(g.dx) + Math.abs(g.dy) < 8;
        const hit = cb.current.onDrop(g.moveX || g.x0, g.moveY || g.y0, tapped);
        if (hit && !tapped) {
          pan.setValue({ x: 0, y: 0 });
          lift.setValue(0);
        } else back();
      },
      onPanResponderTerminate: back,
    }),
  );
  return (
    <View
      style={styles.action}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${a.label}. Drag onto your child or tap.`}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={() => cb.current.onDrop(0, 0, true)}
    >
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.actionIcon,
          {
            opacity: disabled ? 0.5 : 1,
            zIndex: 50,
            transform: [
              ...pan.getTranslateTransform(),
              {
                scale: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.25],
                }),
              },
            ],
          },
        ]}
      >
        <Txt style={{ fontSize: 28 }}>{emoji}</Txt>
      </Animated.View>
      <Txt variant="caption" weight="700" style={{ color: INK }}>
        {a.label}
      </Txt>
    </View>
  );
}

function Ended({ game }: { game: LifeGame }) {
  const [busy, setBusy] = useState(false);
  const saved = !!game.keepsakeSaved;
  return (
    <View
      style={{
        gap: spacing.md,
        backgroundColor: "rgba(255,255,255,0.85)",
        borderRadius: radius.xl,
        padding: spacing.xl,
      }}
    >
      <Txt variant="title" style={{ color: INK }}>
        The life of {game.name}
      </Txt>
      <Txt style={{ color: INK }}>{game.ending}</Txt>
      <Button
        title="Read their story"
        variant="secondary"
        onPress={() => router.push("/games/life/story")}
      />
      <Button
        title={saved ? "Saved to Memories ✓" : "Save the story to Memories"}
        disabled={saved}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await backend.saveLifeKeepsake();
            toast("Saved to your Memories", "success");
          } catch (e) {
            toast(
              e instanceof BackendError ? e.message : "Could not save.",
              "error",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        title="Start a new life"
        variant="ghost"
        onPress={() => router.push("/games/life/start")}
      />
    </View>
  );
}

export default function LifeRoom() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const me = useMe();
  const partner = usePartner();
  const game = useLifeGame();
  const baby = useRef<BabyHandle>(null);
  const [, setTick] = useState(0);
  const [pose, setPose] = useState<Pose>(null);
  const [busy, setBusy] = useState(false);
  const [lampOn, setLampOn] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [particles, setParticles] = useState<ParticleSpec[]>([]);
  const [hour, setHour] = useState(() => new Date().getHours());
  const roomRef = useRef<React.ComponentRef<typeof View>>(null);
  const roomBox = useRef({ x: 0, y: 0, w: 0, h: ROOM_H });
  const lastBubble = useRef(0);
  const room = useRef<RoomHandle>(null);
  const [eager, setEager] = useState(false);
  const eagerRef = useRef(false);
  const [soundOn, setSoundOn] = useState(() => !sfx.isMuted());
  // Browsers only allow audio after a gesture, so music starts on the first interaction.
  const [audioReady, setAudioReady] = useState(false);
  const touch = useCallback(() => setAudioReady(true), []);
  const alive = game?.status === "alive";
  const musicDark = alive && (pose === "sleep" || !lampOn);
  // Adaptive music: the day theme while awake, a lullaby crossfade when the lights go off.
  useEffect(() => {
    if (!audioReady || !alive) return;
    sfx.setMusic(musicDark ? "night" : "day");
  }, [audioReady, alive, musicDark]);
  useEffect(() => () => sfx.stopMusic(), []);
  /** One call per event; the tier keeps the feedback proportional (game-feel skill). */
  const feel = useCallback((tier: FeelTier) => {
    const t = tiers[tier];
    haptic(t.haptic);
    room.current?.shake(t.trauma);
    if (t.flash) room.current?.flash();
  }, []);
  const removeParticle = useCallback(
    (id: number) => setParticles((ps) => ps.filter((p) => p.id !== id)),
    [],
  );
  const add = useCallback(
    (ps: ParticleSpec[]) => setParticles((cur) => [...cur.slice(-40), ...ps]),
    [],
  );

  // Bring the game up to date when the room opens, then every 30 seconds so needs visibly drop.
  useFocusEffect(
    useCallback(() => {
      backend.refreshLifeGame().catch(() => undefined);
      const t = setInterval(() => {
        backend.refreshLifeGame().catch(() => undefined);
        setTick((x) => x + 1);
        setHour(new Date().getHours());
      }, 30_000);
      return () => clearInterval(t);
    }, []),
  );

  if (!game || game.status === "proposed" || game.status === "naming")
    return <Redirect href="/games/life/start" />;

  const now = gameNow(game);
  const needs = decayedNeeds(game, now);
  const mood = game.status === "ended" ? "happy" : moodOf(needs);
  const stage = stageDef(game.stage);
  const nextStage =
    life.stages[life.stages.findIndex((s) => s.id === game.stage) + 1];
  const vote = currentVote(game);
  const waitingChoice = pendingChoice(game);
  const day = Math.min(life.maxDays, Math.floor(ageDays(game, now)) + 1);
  const partnerName = partner?.firstName ?? "Partner";
  const lastPartner = partner
    ? game.log.find((e) => e.userId === partner.id)
    : undefined;
  const myVotePending = vote && me && !vote.picks[me.id];

  const night = hour < 7 || hour >= 20;
  const s = 240 * stage.look.scale;
  const head = s * 0.62;
  // Where the mouth and body are inside the room, from the same proportions the Baby view uses.
  const bodyTop = ROOM_H - BABY_BOTTOM - s * 0.04 - s * 0.42;
  const mouthY = bodyTop + head * 0.08 - head * 0.94 + head * 0.74;
  const bodyY = bodyTop + s * 0.15;

  const measureRoom = () =>
    roomRef.current?.measureInWindow(
      (x, y, w, h) => (roomBox.current = { x, y, w, h }),
    );
  const overBaby = (px: number, py: number) => {
    const r = roomBox.current;
    const x = px - r.x;
    const y = py - r.y;
    return (
      Math.abs(x - r.w / 2) < s * 0.45 &&
      y > mouthY - head * 0.8 &&
      y < ROOM_H - BABY_BOTTOM + 10
    );
  };

  /** Plays the animation for a care action, then saves it. */
  const perform = async (a: LifeActionDef) => {
    if (busy || game.status !== "alive") return;
    setBusy(true);
    const p = poseOf[a.id] ?? null;
    setPose(p);
    const x = roomBox.current.w / 2 || 170;
    touch();
    if (a.id === "feed") {
      [450, 800, 1150, 1500].forEach((ms) => setTimeout(() => sfx.play(["chew1", "chew2"]), ms));
      add([
        particle({
          emoji: foodFor(game.stage),
          x,
          y: mouthY,
          kind: "eaten",
          dx: 120,
          rise: 120,
          size: 40,
          duration: 1900,
        }),
      ]);
      add(burst(["✨", "😋"], x, mouthY, 3, { delay: 1500 }));
    } else if (a.id === "bathe") {
      sfx.play("splash", { vary: 0.5 });
      add(
        burst(["🫧", "🫧", "🧼"], x, bodyY, 14, { rise: 160, duration: 1800 }),
      );
      add([
        particle({
          emoji: "🚿",
          x: x + s * 0.32,
          y: mouthY - head * 0.9,
          kind: "pop",
          size: 34,
          duration: 2200,
        }),
      ]);
    } else if (a.id === "sleep") {
      add(
        burst("💤", x + s * 0.25, mouthY - head * 0.4, 3, {
          delay: 500,
          duration: 2200,
          dx: 40,
          rise: 110,
        }),
      );
    } else if (a.id === "play") {
      sfx.play("boing", { vary: 0.5 });
      add([
        particle({
          emoji: "⚽",
          x: 30,
          y: ROOM_H - 40,
          kind: "bounce",
          dx: (roomBox.current.w || 340) - 60,
          size: 34,
        }),
      ]);
      add(burst(["✨", "😄"], x, mouthY, 4, { delay: 600 }));
    } else {
      if (a.id !== "sleep") sfx.play("sparkle", { db: -2 });
      add(burst(fx[a.id] ?? [a.emoji, "✨"], x, mouthY, 8));
    }
    // The item lands: small impact now, the medium payoff when the care is saved.
    feel("small");
    room.current?.shake(0.12);
    await new Promise((r) => setTimeout(r, p === "sleep" ? 2600 : 1800));
    try {
      const before = game.care;
      const after = await backend.lifeAction(a.id);
      baby.current?.cheer();
      const gained = after.care - before;
      if (gained > 0 && after.stage === game.stage)
        add([particle({ emoji: `+${gained} ❤`, x, y: mouthY - head * 0.9, kind: "number", size: 26, rise: 70, duration: 1200 })]);
      if (after.stage !== game.stage) {
        feel("large");
        sfx.duck();
        sfx.play("fanfare", { vary: 0 });
        add(burst(["🎉", "🎊", "⭐"], x, mouthY, tiers.large.particles));
        add([particle({ emoji: "Grew up!", x, y: mouthY - head, kind: "number", size: 30, rise: 90, duration: 1600 })]);
        toast(`${game.name} grew up! 🎉`, "success");
      } else if (after.care === before)
        toast(
          `You ${a.verb} ${game.name}. Keep going: they need more care before it counts.`,
        );
      else {
        feel("medium");
        sfx.play("ding", { db: -3, vary: 0.6 });
        toast(`You ${a.verb} ${game.name} · +${a.care} care`);
      }
    } catch (e) {
      toast(
        e instanceof BackendError ? e.message : "Something went wrong.",
        "error",
      );
    } finally {
      setPose(null);
      setBusy(false);
    }
  };

  const ff = async (days: number) => {
    try {
      const after = await backend.fastForwardLife(days);
      if (after.stage !== game.stage) {
        feel("large");
        touch();
        sfx.duck();
        sfx.play("fanfare", { vary: 0 });
        baby.current?.cheer();
        add(burst(["🎉", "🎊", "⭐"], (roomBox.current.w || 340) / 2, 200, tiers.large.particles));
      }
      toast(
        after.status === "ended"
          ? "The story has ended."
          : after.stage !== game.stage
            ? `${game.name} grew up! 🎉`
            : `Skipped ${days} day${days > 1 ? "s" : ""}`,
      );
    } catch (e) {
      toast(
        e instanceof BackendError ? e.message : "Could not fast-forward.",
        "error",
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: scenes[game.stage][1] }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Gradient colors={scenes[game.stage]} style={{ flex: 1 }} />
      </View>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
        }}
      >
        {/* top bar */}
        <View style={styles.top}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/games")
            }
            hitSlop={8}
            style={styles.round}
          >
            <Ionicons name="chevron-back" size={22} color={INK} />
          </MotionPressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt variant="heading" style={{ color: INK }}>
              {game.name}
            </Txt>
            <Txt variant="caption" style={{ color: "rgba(43,30,47,0.7)" }}>
              {game.status === "ended"
                ? "Their story is complete"
                : `${stage.label} · Day ${day} of ${life.maxDays}`}
            </Txt>
          </View>
          <MotionPressable
            accessibilityRole="switch"
            accessibilityLabel="Sound"
            accessibilityState={{ checked: soundOn }}
            onPress={() => {
              const next = !soundOn;
              setSoundOn(next);
              sfx.setMuted(!next);
              touch();
              if (next) sfx.play("click", { bus: "ui" });
            }}
            hitSlop={8}
            style={styles.round}
          >
            <Ionicons name={soundOn ? "volume-high-outline" : "volume-mute-outline"} size={20} color={INK} />
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Their story"
            onPress={() => router.push("/games/life/story")}
            hitSlop={8}
            style={styles.round}
          >
            <Ionicons name="book-outline" size={20} color={INK} />
          </MotionPressable>
        </View>

        {game.status === "alive" ? (
          <View style={styles.needs}>
            {life.needs.map((n) => (
              <NeedChip
                key={n.id}
                emoji={n.emoji}
                label={n.label}
                value={needs[n.id]}
              />
            ))}
          </View>
        ) : null}

        {vote ? (
          <MotionPressable
            accessibilityRole="button"
            onPress={() => router.push(`/games/life/vote/${vote.id}`)}
            style={[
              styles.voteBanner,
              {
                backgroundColor: myVotePending ? INK : "rgba(255,255,255,0.8)",
              },
            ]}
          >
            <Txt style={{ fontSize: 22 }}>🗳️</Txt>
            <View style={{ flex: 1 }}>
              <Txt
                variant="bodyStrong"
                style={{ color: myVotePending ? "#FFFFFF" : INK }}
              >
                {choiceDef(vote.choice).title}
              </Txt>
              <Txt
                variant="caption"
                style={{
                  color: myVotePending
                    ? "rgba(255,255,255,0.75)"
                    : "rgba(43,30,47,0.7)",
                }}
              >
                {myVotePending
                  ? `Your vote is needed${partner && vote.picks[partner.id] ? `. ${partnerName} has picked.` : "."}`
                  : `Waiting for ${partnerName}…`}
              </Txt>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={myVotePending ? "#FFFFFF" : INK}
            />
          </MotionPressable>
        ) : null}

        {/* the living room: drag items onto the child, tap toys, switch the light */}
        <View ref={roomRef} onLayout={measureRoom} collapsable={false}>
          <Room
            ref={room}
            stage={game.stage}
            night={night}
            lampOn={lampOn}
            dark={(night && !lampOn) || pose === "sleep" || (!night && !lampOn)}
            onToggleLamp={() => {
              haptic("selection");
              touch();
              sfx.play("click", { bus: "ui", db: 4 });
              setLampOn((v) => !v);
            }}
            height={ROOM_H}
          >
            {pose === "bathe" ? (
              <Txt
                style={{
                  position: "absolute",
                  alignSelf: "center",
                  bottom: 0,
                  fontSize: s * 0.55,
                  zIndex: 9,
                }}
              >
                🛁
              </Txt>
            ) : null}
            <View
              style={{
                position: "absolute",
                bottom: BABY_BOTTOM,
                alignSelf: "center",
                zIndex: 8,
              }}
            >
              <Baby
                ref={baby}
                look={stage.look}
                mood={mood}
                pose={pose}
                eager={eager}
                name={game.name}
                onPoke={() => {
                  if (game.status !== "alive") return;
                  touch();
                  sfx.play(mood === "happy" ? ["giggle1", "giggle2"] : "pop");
                  add(
                    burst(
                      mood === "happy" ? ["😄", "✨"] : ["❔"],
                      (roomBox.current.w || 340) / 2,
                      mouthY,
                      mood === "happy" ? 4 : 1,
                    ),
                  );
                  toast(
                    mood === "happy"
                      ? `${game.name} giggles! 😄`
                      : `${game.name} ${moodLine[mood]}.`,
                  );
                }}
              />
            </View>
            <Effects items={particles} onDone={removeParticle} />
          </Room>
        </View>

        {game.status === "ended" ? (
          <Ended game={game} />
        ) : (
          <>
            <View style={styles.status}>
              <Txt variant="bodyStrong" center style={{ color: INK }}>
                {game.name} {moodLine[mood]}
              </Txt>
              {nextStage ? (
                <>
                  <View style={styles.growTrack}>
                    <View
                      style={{
                        width: `${Math.round(growthProgress(game, now) * 100)}%`,
                        height: "100%",
                        borderRadius: 4,
                        backgroundColor: INK,
                      }}
                    />
                  </View>
                  <Txt
                    variant="caption"
                    center
                    style={{ color: "rgba(43,30,47,0.7)" }}
                  >
                    {waitingChoice
                      ? `Decide "${choiceDef(waitingChoice).title.toLowerCase()}" together so ${game.name} can grow up`
                      : `Growing into: ${nextStage.label} · ${game.care}/${stage.careToGrow} care`}
                  </Txt>
                </>
              ) : (
                <Txt
                  variant="caption"
                  center
                  style={{ color: "rgba(43,30,47,0.7)" }}
                >
                  Golden years · {game.care}/{stage.careToGrow} care
                </Txt>
              )}
              {lastPartner ? (
                <Txt
                  variant="caption"
                  center
                  style={{ color: "rgba(43,30,47,0.7)" }}
                >
                  {partnerName}
                  {partner?.isSimulated ? " (simulated)" : ""}{" "}
                  {actionDef(lastPartner.actionId)?.verb} {game.name}{" "}
                  {relativeTime(lastPartner.at, new Date(now))}
                </Txt>
              ) : null}
            </View>

            <Txt
              variant="caption"
              center
              style={{ color: "rgba(43,30,47,0.7)" }}
            >
              {busy
                ? `${game.name} is busy…`
                : `Drag an item onto ${game.name}, or tap it. Scrub with the soap to make bubbles.`}
            </Txt>
            <View style={[styles.actions, { zIndex: 30 }]}>
              {stageActions(game).map((a) => (
                <DragItem
                  key={a.id}
                  a={a}
                  emoji={
                    a.id === "feed"
                      ? foodFor(game.stage)
                      : a.id === "bathe"
                        ? "🧼"
                        : a.emoji
                  }
                  disabled={busy}
                  onStart={() => {
                    touch();
                    sfx.play("pickup", { bus: "ui" });
                    measureRoom();
                    setDragging(true);
                  }}
                  onMove={(x, y) => {
                    const over = overBaby(x, y);
                    if (over !== eagerRef.current) {
                      eagerRef.current = over;
                      setEager(over);
                      if (over) {
                        haptic("selection");
                        sfx.play("hover", { bus: "ui" });
                      }
                    }
                    // Scrubbing the child with the soap leaves a trail of bubbles.
                    if (
                      a.id !== "bathe" ||
                      !overBaby(x, y) ||
                      Date.now() - lastBubble.current < 70
                    )
                      return;
                    lastBubble.current = Date.now();
                    sfx.play("bubble", { db: -6, vary: 2 });
                    add([
                      particle({
                        emoji: "🫧",
                        x: x - roomBox.current.x,
                        y: y - roomBox.current.y,
                        kind: "rise",
                        dx: (Math.random() - 0.5) * 40,
                        rise: 60 + Math.random() * 60,
                        size: 16 + Math.random() * 12,
                      }),
                    ]);
                  }}
                  onDrop={(x, y, tapped) => {
                    setDragging(false);
                    eagerRef.current = false;
                    setEager(false);
                    if (tapped || overBaby(x, y)) {
                      if (!tapped) sfx.play("land", { db: -2 });
                      perform(a);
                      return true;
                    }
                    return false;
                  }}
                />
              ))}
            </View>

            {session?.demo ? (
              <View style={styles.demo}>
                <Txt
                  variant="caption"
                  style={{ color: "rgba(43,30,47,0.7)", flex: 1 }}
                >
                  🧪 Demo: skip time as if you both cared well
                </Txt>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => ff(1)}
                  style={styles.ffBtn}
                >
                  <Txt variant="caption" weight="700" style={{ color: INK }}>
                    +1 day
                  </Txt>
                </MotionPressable>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => ff(7)}
                  style={styles.ffBtn}
                >
                  <Txt variant="caption" weight="700" style={{ color: INK }}>
                    +1 week
                  </Txt>
                </MotionPressable>
              </View>
            ) : null}
            <Txt
              variant="caption"
              center
              style={{ color: "rgba(43,30,47,0.6)" }}
            >
              {fill(
                game.name,
                "Needs drop in real time. Care only counts while {name} is doing okay overall.",
              )}
            </Txt>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  needs: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  need: { alignItems: "center", gap: 6, width: 52 },
  needIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  needTrack: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(43,30,47,0.12)",
    overflow: "hidden",
  },
  voteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  status: {
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  growTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(43,30,47,0.12)",
    overflow: "hidden",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
  },
  action: { alignItems: "center", gap: 4, width: 72 },
  actionIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: radius.lg,
    padding: spacing.sm,
    paddingLeft: spacing.md,
  },
  ffBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
});
