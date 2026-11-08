import { MotionPressable } from "@/components/ui/MotionPressable";
import React, { useEffect, useImperativeHandle, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { haptic } from "@/lib/haptics";
import type { LifeLook, LifeMood } from "@/lib/lifeGame";

const SKIN = "#FFD9C2";
const SKIN_SHADE = "#F6C3A6";
const INK = "#2B1E2F";
const HAIR = "#5B3A29";
const GREY = "#CFCFD6";

const moodBubble: Partial<Record<LifeMood, string>> = {
  hungry: "🍼",
  sleepy: "💤",
  dirty: "🫧",
  bored: "🎈",
  lonely: "💗",
  sad: "💧",
};

export interface BabyHandle {
  /** Play a happy bounce, e.g. after a care action. */
  cheer: () => void;
}

interface BabyProps {
  look: LifeLook;
  mood: LifeMood;
  /** Base size of the character in points before the stage scale. */
  size?: number;
  name?: string | null;
  onPoke?: () => void;
  /** What the child is doing right now: eating chews, bathing adds foam, sleeping closes the eyes. */
  pose?: "feed" | "bathe" | "sleep" | null;
  /** An item is held over the child: they lean in and look eager (anticipation). */
  eager?: boolean;
}

/**
 * The child, drawn from plain Views so it renders the same on web and native and needs no image
 * assets. It breathes, blinks, bounces when tapped, and changes face and outfit with mood and age.
 */
export const Baby = React.forwardRef<BabyHandle, BabyProps>(function Baby(
  { look, mood, size = 240, name, onPoke, pose = null, eager = false },
  ref,
) {
  const s = size * look.scale;
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const chew = useRef(new Animated.Value(0)).current;
  // Squash & stretch: 0 = rest, -1 = squashed flat, 1 = stretched tall.
  const squash = useRef(new Animated.Value(0)).current;
  const lean = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(lean, { toValue: eager ? 1 : 0, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [eager, lean]);

  useEffect(() => {
    if (pose !== "feed") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chew, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(chew, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pose, chew]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    let alive = true;
    const blinkOnce = () => {
      if (!alive) return;
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => setTimeout(blinkOnce, 2500 + Math.random() * 2500));
    };
    const t = setTimeout(blinkOnce, 1800);
    return () => {
      alive = false;
      clearTimeout(t);
      loop.stop();
    };
  }, [breathe, blink]);

  const bounce = () => {
    jump.setValue(0);
    wiggle.setValue(0);
    // Squash on the event, stretch on the way up, squash again on landing, then spring back past rest.
    squash.setValue(-1);
    Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(squash, { toValue: -0.6, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.spring(squash, { toValue: 0, friction: 3, tension: 140, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(jump, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(jump, {
          toValue: 0,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: -1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };
  useImperativeHandle(ref, () => ({ cheer: bounce }));

  const scale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });
  const translateY = jump.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -s * 0.18],
  });
  const rotate = wiggle.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-6deg", "6deg"],
  });

  const head = s * 0.62;
  const eye = head * 0.11;
  const hairColor = look.hair === "grey" ? GREY : HAIR;
  const happy = mood === "happy" || eager;
  const sad = mood === "sad" || mood === "lonely";
  const sleepy = (mood === "sleepy" || pose === "sleep") && !eager;

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${name ?? "Your little one"}, feeling ${mood}. Tap to play.`}
      onPress={() => {
        haptic("light");
        bounce();
        onPoke?.();
      }}
      style={{
        width: s * 1.1,
        height: s * 1.25,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {/* ground shadow */}
      <Animated.View
        style={[
          styles.shadow,
          {
            width: s * 0.7,
            height: s * 0.09,
            borderRadius: s,
            transform: [{ scaleX: scale }],
          },
        ]}
      />
      <Animated.View
        style={{
          alignItems: "center",
          position: "absolute",
          bottom: s * 0.04,
          transform: [
            { translateY },
            { translateY: lean.interpolate({ inputRange: [0, 1], outputRange: [0, -s * 0.03] }) },
            { rotate },
            { scale },
            { scale: lean.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
            // keep the feet on the floor while squashing (transforms scale from the centre)
            { translateY: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [s * 0.09, 0, -s * 0.07] }) },
            { scaleX: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.22, 1, 0.86] }) },
            { scaleY: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.8, 1, 1.16] }) },
          ],
        }}
      >
        {moodBubble[mood] && !pose ? (
          <View style={[styles.bubble, { top: -s * 0.05, right: -s * 0.18 }]}>
            <Text style={{ fontSize: s * 0.11 }}>{moodBubble[mood]}</Text>
          </View>
        ) : null}

        {/* long hair sits behind the head */}
        {look.hair === "long" ? (
          <View
            style={{
              position: "absolute",
              top: head * 0.18,
              width: head * 1.08,
              height: head * 0.95,
              borderRadius: head * 0.4,
              backgroundColor: hairColor,
            }}
          />
        ) : null}

        {/* head */}
        <View
          style={{
            width: head,
            height: head * 0.94,
            borderRadius: head / 2,
            backgroundColor: SKIN,
            alignItems: "center",
            zIndex: 2,
          }}
        >
          {/* ears */}
          <View
            style={[
              styles.ear,
              {
                left: -head * 0.06,
                top: head * 0.42,
                width: head * 0.16,
                height: head * 0.2,
                borderRadius: head * 0.1,
              },
            ]}
          />
          <View
            style={[
              styles.ear,
              {
                right: -head * 0.06,
                top: head * 0.42,
                width: head * 0.16,
                height: head * 0.2,
                borderRadius: head * 0.1,
              },
            ]}
          />

          {/* hair on top */}
          {look.hair === "tuft" ? (
            <View
              style={{
                position: "absolute",
                top: -head * 0.06,
                width: head * 0.16,
                height: head * 0.2,
                borderTopLeftRadius: head * 0.16,
                borderTopRightRadius: head * 0.02,
                borderBottomRightRadius: head * 0.16,
                backgroundColor: hairColor,
                transform: [{ rotate: "-20deg" }],
              }}
            />
          ) : null}
          {look.hair === "short" ||
          look.hair === "grey" ||
          look.hair === "long" ? (
            <View
              style={{
                position: "absolute",
                top: -head * 0.02,
                width: head * 1.02,
                height: head * 0.42,
                borderTopLeftRadius: head * 0.5,
                borderTopRightRadius: head * 0.5,
                borderBottomLeftRadius: head * 0.12,
                borderBottomRightRadius: head * 0.28,
                backgroundColor: hairColor,
              }}
            />
          ) : null}

          {/* headphones */}
          {look.accessory === "headphones" ? (
            <>
              <View
                style={{
                  position: "absolute",
                  top: -head * 0.1,
                  width: head * 1.08,
                  height: head * 0.6,
                  borderRadius: head,
                  borderWidth: head * 0.05,
                  borderColor: "#3A3550",
                  borderBottomColor: "transparent",
                  borderLeftColor: "#3A3550",
                  borderRightColor: "#3A3550",
                }}
              />
              <View
                style={[
                  styles.cup,
                  {
                    left: -head * 0.1,
                    top: head * 0.36,
                    width: head * 0.18,
                    height: head * 0.26,
                    borderRadius: head * 0.08,
                  },
                ]}
              />
              <View
                style={[
                  styles.cup,
                  {
                    right: -head * 0.1,
                    top: head * 0.36,
                    width: head * 0.18,
                    height: head * 0.26,
                    borderRadius: head * 0.08,
                  },
                ]}
              />
            </>
          ) : null}

          {/* eyebrows when sad */}
          {sad ? (
            <View
              style={{
                position: "absolute",
                top: head * 0.4,
                flexDirection: "row",
                gap: head * 0.2,
              }}
            >
              <View
                style={[
                  styles.brow,
                  {
                    width: eye * 1.6,
                    height: eye * 0.32,
                    transform: [{ rotate: "-18deg" }],
                  },
                ]}
              />
              <View
                style={[
                  styles.brow,
                  {
                    width: eye * 1.6,
                    height: eye * 0.32,
                    transform: [{ rotate: "18deg" }],
                  },
                ]}
              />
            </View>
          ) : null}

          {/* eyes */}
          <View
            style={{
              position: "absolute",
              top: head * 0.48,
              flexDirection: "row",
              gap: head * 0.24,
            }}
          >
            {[0, 1].map((i) =>
              sleepy ? (
                <View
                  key={i}
                  style={{
                    width: eye * 1.4,
                    height: eye * 0.32,
                    borderRadius: eye,
                    backgroundColor: INK,
                    marginTop: eye * 0.5,
                  }}
                />
              ) : (
                <Animated.View
                  key={i}
                  style={{
                    width: eye,
                    height: eye * 1.25,
                    borderRadius: eye,
                    backgroundColor: INK,
                    transform: [{ scaleY: blink }],
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: eye * 0.18,
                      left: eye * 0.2,
                      width: eye * 0.34,
                      height: eye * 0.34,
                      borderRadius: eye,
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                </Animated.View>
              ),
            )}
          </View>

          {/* glasses */}
          {look.accessory === "glasses" ? (
            <View
              style={{
                position: "absolute",
                top: head * 0.41,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={[
                  styles.lens,
                  {
                    width: head * 0.26,
                    height: head * 0.22,
                    borderRadius: head * 0.1,
                    borderWidth: head * 0.025,
                  },
                ]}
              />
              <View
                style={{
                  width: head * 0.06,
                  height: head * 0.025,
                  backgroundColor: "#6B5A4E",
                }}
              />
              <View
                style={[
                  styles.lens,
                  {
                    width: head * 0.26,
                    height: head * 0.22,
                    borderRadius: head * 0.1,
                    borderWidth: head * 0.025,
                  },
                ]}
              />
            </View>
          ) : null}

          {/* cheeks */}
          <View
            style={{
              position: "absolute",
              top: head * 0.64,
              flexDirection: "row",
              gap: head * 0.46,
            }}
          >
            <View
              style={[
                styles.cheek,
                { width: head * 0.13, height: head * 0.08, borderRadius: head },
              ]}
            />
            <View
              style={[
                styles.cheek,
                { width: head * 0.13, height: head * 0.08, borderRadius: head },
              ]}
            />
          </View>

          {/* mouth */}
          <View
            style={{
              position: "absolute",
              top: head * 0.68,
              alignItems: "center",
            }}
          >
            {pose === "feed" ? (
              <Animated.View
                style={{
                  width: head * 0.16,
                  height: head * 0.14,
                  borderRadius: head,
                  backgroundColor: "#B5445C",
                  transform: [
                    {
                      scaleY: chew.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.25],
                      }),
                    },
                  ],
                }}
              />
            ) : pose === "sleep" ? (
              <View
                style={{
                  width: head * 0.08,
                  height: head * 0.08,
                  borderRadius: head,
                  backgroundColor: "#B5445C",
                  marginTop: head * 0.03,
                }}
              />
            ) : look.accessory === "pacifier" && mood !== "hungry" ? (
              <View
                style={{
                  width: head * 0.2,
                  height: head * 0.2,
                  borderRadius: head,
                  backgroundColor: "#8FD3FF",
                  borderWidth: head * 0.025,
                  borderColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: head * 0.07,
                    height: head * 0.07,
                    borderRadius: head,
                    backgroundColor: "#FFFFFF",
                  }}
                />
              </View>
            ) : mood === "hungry" ? (
              <View
                style={{
                  width: head * 0.12,
                  height: head * 0.14,
                  borderRadius: head,
                  backgroundColor: "#B5445C",
                }}
              />
            ) : sad ? (
              <View
                style={{
                  width: head * 0.18,
                  height: head * 0.09,
                  borderTopLeftRadius: head,
                  borderTopRightRadius: head,
                  borderWidth: head * 0.022,
                  borderBottomWidth: 0,
                  borderColor: INK,
                  marginTop: head * 0.04,
                }}
              />
            ) : (
              <View
                style={{
                  width: happy ? head * 0.22 : head * 0.16,
                  height: happy ? head * 0.12 : head * 0.06,
                  borderBottomLeftRadius: head,
                  borderBottomRightRadius: head,
                  backgroundColor: happy ? "#B5445C" : "transparent",
                  borderWidth: happy ? 0 : head * 0.022,
                  borderTopWidth: 0,
                  borderColor: INK,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                {happy ? (
                  <View
                    style={{
                      width: head * 0.12,
                      height: head * 0.05,
                      borderTopLeftRadius: head,
                      borderTopRightRadius: head,
                      backgroundColor: "#FF8FA3",
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>

          {/* dirt spots */}
          {mood === "dirty" && pose !== "bathe" ? (
            <>
              <View
                style={[
                  styles.dirt,
                  {
                    top: head * 0.24,
                    left: head * 0.2,
                    width: head * 0.1,
                    height: head * 0.07,
                  },
                ]}
              />
              <View
                style={[
                  styles.dirt,
                  {
                    top: head * 0.76,
                    right: head * 0.16,
                    width: head * 0.08,
                    height: head * 0.06,
                  },
                ]}
              />
            </>
          ) : null}
        </View>

        {pose === "bathe" ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -head * 0.12,
              width: head * 1.1,
              height: head * 0.4,
              zIndex: 3,
            }}
          >
            {[
              [0.05, 0.18, 0.34],
              [0.28, 0, 0.42],
              [0.58, 0.04, 0.38],
              [0.8, 0.2, 0.28],
            ].map(([l, t, d], i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: head * l,
                  top: head * t,
                  width: head * d,
                  height: head * d,
                  borderRadius: head,
                  backgroundColor: "#FFFFFF",
                  opacity: 0.95,
                }}
              />
            ))}
          </View>
        ) : null}

        {/* body */}
        <View
          style={{
            marginTop: -head * 0.08,
            width: s * 0.5,
            height: s * 0.42,
            borderTopLeftRadius: s * 0.22,
            borderTopRightRadius: s * 0.22,
            borderBottomLeftRadius: s * 0.14,
            borderBottomRightRadius: s * 0.14,
            backgroundColor: look.outfit,
            alignItems: "center",
            zIndex: 1,
          }}
        >
          {/* arms */}
          <View
            style={[
              styles.arm,
              {
                left: -s * 0.06,
                top: s * 0.08,
                width: s * 0.13,
                height: s * 0.24,
                borderRadius: s * 0.07,
                backgroundColor: look.outfit,
                transform: [{ rotate: happy ? "-35deg" : "12deg" }],
              },
            ]}
          >
            <View
              style={[
                styles.hand,
                {
                  width: s * 0.09,
                  height: s * 0.09,
                  borderRadius: s,
                  bottom: -s * 0.02,
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.arm,
              {
                right: -s * 0.06,
                top: s * 0.08,
                width: s * 0.13,
                height: s * 0.24,
                borderRadius: s * 0.07,
                backgroundColor: look.outfit,
                transform: [{ rotate: happy ? "35deg" : "-12deg" }],
              },
            ]}
          >
            <View
              style={[
                styles.hand,
                {
                  width: s * 0.09,
                  height: s * 0.09,
                  borderRadius: s,
                  bottom: -s * 0.02,
                },
              ]}
            />
          </View>
          {/* collar shading */}
          <View
            style={{
              width: s * 0.2,
              height: s * 0.05,
              borderBottomLeftRadius: s,
              borderBottomRightRadius: s,
              backgroundColor: SKIN_SHADE,
              opacity: 0.6,
            }}
          />
          {look.accessory === "tie" ? (
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: s * 0.04,
                borderRightWidth: s * 0.04,
                borderTopWidth: s * 0.17,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: "#C0395B",
              }}
            />
          ) : null}
          {look.accessory === "backpack" ? (
            <>
              <View
                style={[
                  styles.strap,
                  { left: s * 0.1, width: s * 0.04, height: s * 0.3 },
                ]}
              />
              <View
                style={[
                  styles.strap,
                  { right: s * 0.1, width: s * 0.04, height: s * 0.3 },
                ]}
              />
            </>
          ) : null}
          {look.accessory === "ring" ? (
            <Text
              style={{
                position: "absolute",
                bottom: s * 0.04,
                left: -s * 0.07,
                fontSize: s * 0.08,
              }}
            >
              💍
            </Text>
          ) : null}
          {/* feet */}
          <View
            style={{
              position: "absolute",
              bottom: -s * 0.04,
              flexDirection: "row",
              gap: s * 0.1,
            }}
          >
            <View
              style={[
                styles.foot,
                { width: s * 0.14, height: s * 0.07, borderRadius: s },
              ]}
            />
            <View
              style={[
                styles.foot,
                { width: s * 0.14, height: s * 0.07, borderRadius: s },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    </MotionPressable>
  );
});

const styles = StyleSheet.create({
  shadow: { backgroundColor: "rgba(0,0,0,0.12)" },
  bubble: {
    position: "absolute",
    zIndex: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  ear: { position: "absolute", backgroundColor: SKIN_SHADE },
  cup: { position: "absolute", backgroundColor: "#3A3550" },
  brow: { backgroundColor: INK, borderRadius: 4 },
  lens: { borderColor: "#6B5A4E", backgroundColor: "rgba(255,255,255,0.25)" },
  cheek: { backgroundColor: "#FF9DB0", opacity: 0.75 },
  dirt: {
    position: "absolute",
    backgroundColor: "#9C7B5B",
    borderRadius: 99,
    opacity: 0.7,
  },
  arm: { position: "absolute" },
  hand: { position: "absolute", alignSelf: "center", backgroundColor: SKIN },
  strap: {
    position: "absolute",
    top: 0,
    backgroundColor: "#E2574C",
    borderRadius: 4,
  },
  foot: { backgroundColor: "#5A4B6B" },
});
