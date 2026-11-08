import { useAnim } from './useAnim';
import React, { useEffect, useImperativeHandle, useRef } from "react";

import { useReducedMotion } from "./feel";
import { play } from "./sound";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { haptic } from "@/lib/haptics";
import type { LifeStageId } from "@/services/backend";

/** Wall, floor and props for each age. The props can be tapped and wiggle. */
export const roomTheme: Record<
  LifeStageId,
  {
    wall: string;
    floor: string;
    rug: string;
    props: {
      emoji: string;
      left: `${number}%`;
      bottom: number;
      size: number;
    }[];
    wallArt: string;
  }
> = {
  newborn: {
    wall: "#DCEEFF",
    floor: "#C9DDF2",
    rug: "#FFFFFF",
    wallArt: "⭐",
    props: [
      { emoji: "🧸", left: "6%", bottom: 26, size: 40 },
      { emoji: "🛏️", left: "76%", bottom: 22, size: 52 },
    ],
  },
  toddler: {
    wall: "#FFF1C9",
    floor: "#F1D39A",
    rug: "#FFB37A",
    wallArt: "🌈",
    props: [
      { emoji: "🧱", left: "5%", bottom: 24, size: 34 },
      { emoji: "🪀", left: "17%", bottom: 50, size: 26 },
      { emoji: "🦆", left: "80%", bottom: 24, size: 38 },
    ],
  },
  child: {
    wall: "#D7F5E6",
    floor: "#B7DCC4",
    rug: "#6CC79A",
    wallArt: "🗺️",
    props: [
      { emoji: "🎒", left: "6%", bottom: 24, size: 38 },
      { emoji: "📚", left: "78%", bottom: 24, size: 40 },
    ],
  },
  teen: {
    wall: "#E6DEFF",
    floor: "#C7BCEB",
    rug: "#8E7CF0",
    wallArt: "🎸",
    props: [
      { emoji: "🛹", left: "5%", bottom: 22, size: 38 },
      { emoji: "🎮", left: "80%", bottom: 26, size: 34 },
    ],
  },
  adult: {
    wall: "#DDF3FA",
    floor: "#B9D9E5",
    rug: "#5FB3D4",
    wallArt: "🖼️",
    props: [
      { emoji: "🪴", left: "5%", bottom: 22, size: 44 },
      { emoji: "💻", left: "80%", bottom: 26, size: 36 },
    ],
  },
  partnered: {
    wall: "#FFE2E8",
    floor: "#F0C3CD",
    rug: "#FF8FAB",
    wallArt: "💞",
    props: [
      { emoji: "🕯️", left: "7%", bottom: 26, size: 32 },
      { emoji: "🪴", left: "80%", bottom: 22, size: 44 },
    ],
  },
  elder: {
    wall: "#F3EBDD",
    floor: "#DCC9A8",
    rug: "#B98A5E",
    wallArt: "🕰️",
    props: [
      { emoji: "🧶", left: "6%", bottom: 24, size: 34 },
      { emoji: "🪑", left: "78%", bottom: 22, size: 46 },
    ],
  },
};

function Prop({
  emoji,
  size,
  style,
}: {
  emoji: string;
  size: number;
  style: object;
}) {
  const w = useAnim(0);
  const wiggle = () => {
    haptic("light");
    play("pop", { vary: 3 });
    w.setValue(0);
    Animated.sequence([
      Animated.timing(w, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(w, { toValue: -1, duration: 140, useNativeDriver: true }),
      Animated.spring(w, { toValue: 0, friction: 3, useNativeDriver: true }),
    ]).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toy"
      onPress={wiggle}
      style={[styles.abs, style]}
    >
      <Animated.Text
        style={{
          fontSize: size,
          transform: [
            {
              rotate: w.interpolate({
                inputRange: [-1, 1],
                outputRange: ["-14deg", "14deg"],
              }),
            },
            {
              translateY: w.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-6, 0, -10],
              }),
            },
          ],
        }}
      >
        {emoji}
      </Animated.Text>
    </Pressable>
  );
}

/** Sky seen through the window: a sun and drifting clouds by day, a moon and twinkling stars at night. */
function Sky({ night }: { night: boolean }) {
  const drift = useAnim(0);
  const twinkle = useAnim(0);
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [drift, twinkle]);
  return (
    <View
      style={[
        styles.window,
        { backgroundColor: night ? "#1F2A52" : "#8FD3FF" },
      ]}
    >
      {night ? (
        <>
          <Text style={[styles.abs, { top: 8, right: 12, fontSize: 26 }]}>
            🌙
          </Text>
          {[
            [14, 12],
            [48, 30],
            [26, 52],
            [70, 14],
          ].map(([l, t], i) => (
            <Animated.Text
              key={i}
              style={[
                styles.abs,
                {
                  left: `${l}%`,
                  top: t,
                  fontSize: 10,
                  opacity:
                    i % 2
                      ? twinkle
                      : twinkle.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.2],
                        }),
                },
              ]}
            >
              ✦
            </Animated.Text>
          ))}
        </>
      ) : (
        <>
          <Text style={[styles.abs, { top: 6, right: 10, fontSize: 26 }]}>
            ☀️
          </Text>
          <Animated.Text
            style={[
              styles.abs,
              {
                top: 26,
                fontSize: 24,
                transform: [
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-40, 150],
                    }),
                  },
                ],
              },
            ]}
          >
            ☁️
          </Animated.Text>
          <Animated.Text
            style={[
              styles.abs,
              {
                top: 46,
                fontSize: 18,
                transform: [
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [60, 190],
                    }),
                  },
                ],
              },
            ]}
          >
            ☁️
          </Animated.Text>
        </>
      )}
      {/* window frame */}
      <View style={styles.mullionV} />
      <View style={styles.mullionH} />
    </View>
  );
}

interface RoomProps {
  stage: LifeStageId;
  /** It is night outside (from the local clock). */
  night: boolean;
  /** Lights are off: either switched off or the child is asleep. */
  dark: boolean;
  onToggleLamp: () => void;
  lampOn: boolean;
  height: number;
  children?: React.ReactNode;
}

export interface RoomHandle {
  /** Adds shake "trauma" (0..1). Shake is trauma squared and decays on its own. */
  shake: (amount: number) => void;
  /** A brief white flash for the biggest moments. */
  flash: () => void;
}

/** The scene the child lives in. It changes with age, time of day and the light switch. */
export const Room = React.forwardRef<RoomHandle, RoomProps>(function Room({
  stage,
  night,
  dark,
  onToggleLamp,
  lampOn,
  height,
  children,
}, ref) {
  const t = roomTheme[stage];
  const reduce = useReducedMotion();
  const shakeX = useAnim(0);
  const shakeY = useAnim(0);
  const roll = useAnim(0);
  const flashA = useAnim(0);
  const trauma = useRef(0);
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
  }, []);
  useImperativeHandle(ref, () => ({
    shake: (amount) => {
      if (reduce || amount <= 0) return;
      trauma.current = Math.min(1, trauma.current + amount);
      if (frame.current != null) return;
      let last = Date.now();
      let time = Math.random() * 100;
      const step = () => {
        const now = Date.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;
        trauma.current = Math.max(0, trauma.current - 1.3 * dt);
        const k = trauma.current * trauma.current;
        // Layered sines, not random jitter, so it reads as a shake rather than static.
        shakeX.setValue(12 * k * (0.6 * Math.sin(time * 37) + 0.4 * Math.sin(time * 71)));
        shakeY.setValue(8 * k * (0.6 * Math.sin(time * 43 + 1) + 0.4 * Math.sin(time * 67 + 2)));
        roll.setValue(4 * k * Math.sin(time * 29));
        if (trauma.current > 0) frame.current = requestAnimationFrame(step);
        else frame.current = null;
      };
      frame.current = requestAnimationFrame(step);
    },
    flash: () => {
      if (reduce) return;
      flashA.setValue(0.7);
      Animated.timing(flashA, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    },
  }));
  const shade = useAnim(dark ? 1 : 0);
  useEffect(() => {
    Animated.timing(shade, {
      toValue: dark ? 1 : 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [dark, shade]);

  return (
    <Animated.View
      style={{
        height,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: t.wall,
        transform: [
          { translateX: shakeX },
          { translateY: shakeY },
          { rotate: roll.interpolate({ inputRange: [-10, 10], outputRange: ["-10deg", "10deg"] }) },
        ],
      }}
    >
      <Sky night={night} />
      <Text style={[styles.abs, { top: 24, left: "62%", fontSize: 34 }]}>
        {t.wallArt}
      </Text>
      {/* lamp you can switch */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: lampOn }}
        accessibilityLabel="Light"
        onPress={onToggleLamp}
        style={[styles.abs, { top: 0, right: 26, alignItems: "center" }]}
      >
        <View
          style={{
            width: 2,
            height: 30,
            backgroundColor: "rgba(43,30,47,0.35)",
          }}
        />
        <View
          style={[
            styles.lampShade,
            { backgroundColor: lampOn ? "#FFD66B" : "#B9B2C4" },
          ]}
        />
        {lampOn ? <View style={styles.glow} /> : null}
      </Pressable>
      {/* floor and rug */}
      <View style={[styles.floor, { backgroundColor: t.floor }]} />
      <View style={[styles.rug, { backgroundColor: t.rug }]} />
      {t.props.map((p, i) => (
        <Prop
          key={`${stage}-${i}`}
          emoji={p.emoji}
          size={p.size}
          style={{ left: p.left, bottom: p.bottom }}
        />
      ))}
      {children}
      {/* lights-off shade sits above everything except the moonlit window glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#0E1030",
            opacity: shade.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.55],
            }),
            zIndex: 15,
          },
        ]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF", opacity: flashA, zIndex: 16 }]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  window: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 130,
    height: 86,
    borderRadius: 14,
    borderWidth: 5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  mullionV: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 4,
    marginLeft: -2,
    backgroundColor: "#FFFFFF",
  },
  mullionH: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 4,
    marginTop: -2,
    backgroundColor: "#FFFFFF",
  },
  lampShade: {
    width: 44,
    height: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  glow: {
    position: "absolute",
    top: 46,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,214,107,0.25)",
  },
  floor: { position: "absolute", left: 0, right: 0, bottom: 0, height: "32%" },
  rug: {
    position: "absolute",
    alignSelf: "center",
    left: "18%",
    right: "18%",
    bottom: 14,
    height: 36,
    borderRadius: 999,
    opacity: 0.55,
  },
});
