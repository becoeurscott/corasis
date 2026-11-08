import { useAnim } from './useAnim';
import React, { useEffect } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
} from "react-native";

export type ParticleKind = "rise" | "eaten" | "bounce" | "pop" | "number";

export interface ParticleSpec {
  id: number;
  emoji: string;
  /** Start position inside the room, in points. */
  x: number;
  y: number;
  kind: ParticleKind;
  size?: number;
  dx?: number;
  rise?: number;
  delay?: number;
  duration?: number;
}

let nextId = 1;
/** Builds a burst of particles around a point, e.g. hearts after a cuddle. */
export function burst(
  emoji: string | string[],
  x: number,
  y: number,
  count: number,
  opts: Partial<ParticleSpec> = {},
): ParticleSpec[] {
  const list = Array.isArray(emoji) ? emoji : [emoji];
  return Array.from({ length: count }, (_, i) => ({
    id: nextId++,
    emoji: list[i % list.length],
    x: x + (Math.random() - 0.5) * 80,
    y: y + (Math.random() - 0.5) * 30,
    kind: "rise" as ParticleKind,
    dx: (Math.random() - 0.5) * 70,
    rise: 90 + Math.random() * 90,
    delay: i * 90,
    size: 18 + Math.random() * 14,
    ...opts,
  }));
}
export function particle(spec: Omit<ParticleSpec, "id">): ParticleSpec {
  return { id: nextId++, ...spec };
}

/** One floating emoji. It plays its motion once and then removes itself. */
function Particle({
  p,
  onDone,
}: {
  p: ParticleSpec;
  onDone: (id: number) => void;
}) {
  const v = useAnim(0);
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(p.delay ?? 0),
      Animated.timing(v, {
        toValue: 1,
        duration: p.duration ?? (p.kind === "bounce" ? 1800 : 1300),
        easing: p.kind === "bounce" ? Easing.linear : Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(() => onDone(p.id));
    return () => anim.stop();
  }, [v, p, onDone]);

  const size = p.size ?? 26;
  let transform: NonNullable<
    React.ComponentProps<typeof Animated.View>["style"]
  > extends never
    ? never
    : any[] = [];
  let opacity: Animated.AnimatedInterpolation<number> | number = 1;
  if (p.kind === "rise") {
    transform = [
      {
        translateX: v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.dx ?? 0],
        }),
      },
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(p.rise ?? 120)],
        }),
      },
      {
        scale: v.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0.3, 1.1, 0.9],
        }),
      },
    ];
    opacity = v.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [1, 1, 0],
    });
  } else if (p.kind === "eaten") {
    // Flies in from the side, then shrinks into the mouth bite by bite.
    transform = [
      {
        translateX: v.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [p.dx ?? 0, 0, 0],
        }),
      },
      {
        translateY: v.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [-(p.rise ?? 0), 0, 0],
        }),
      },
      {
        scale: v.interpolate({
          inputRange: [0, 0.35, 0.5, 0.65, 0.8, 1],
          outputRange: [1, 1, 0.75, 0.75, 0.4, 0],
        }),
      },
      {
        rotate: v.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: ["-30deg", "0deg", "10deg"],
        }),
      },
    ];
  } else if (p.kind === "bounce") {
    // A ball bouncing across the floor.
    transform = [
      {
        translateX: v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.dx ?? 200],
        }),
      },
      {
        translateY: v.interpolate({
          inputRange: [0, 0.2, 0.4, 0.58, 0.76, 0.88, 1],
          outputRange: [0, -120, 0, -70, 0, -30, 0],
        }),
      },
      {
        rotate: v.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "720deg"],
        }),
      },
    ];
    opacity = v.interpolate({
      inputRange: [0, 0.9, 1],
      outputRange: [1, 1, 0],
    });
  } else if (p.kind === "number") {
    // "+15" pops in with overshoot, then floats up and fades.
    transform = [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -(p.rise ?? 70)] }) },
      { scale: v.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0.2, 1.35, 1, 1] }) },
    ];
    opacity = v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  } else {
    transform = [
      {
        scale: v.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, 1.3, 1.6],
        }),
      },
    ];
    opacity = v.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [1, 0.9, 0],
    });
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.p,
        { left: p.x - size / 2, top: p.y - size / 2, opacity, transform },
      ]}
    >
      {p.kind === "number" ? (
        <Text style={{ fontSize: size, fontWeight: "900", color: "#FFFFFF", textShadowColor: "rgba(43,30,47,0.55)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 }, width: 120, marginLeft: -60 + size / 2, textAlign: "center" }}>{p.emoji}</Text>
      ) : (
        <Text style={{ fontSize: size }}>{p.emoji}</Text>
      )}
    </Animated.View>
  );
}

export function Effects({
  items,
  onDone,
}: {
  items: ParticleSpec[];
  onDone: (id: number) => void;
}) {
  return (
    <>
      {items.map((p) => (
        <Particle key={p.id} p={p} onDone={onDone} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({ p: { position: "absolute", zIndex: 20 } });
