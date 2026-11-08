import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, PressableProps, StyleSheet } from 'react-native';

import { motion, useReducedMotion } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Interruptible, native-driven touch feedback; no delays before the actual action. */
export function MotionPressable({ style, disabled, onPressIn, onPressOut, onFocus, onBlur, ...props }: PressableProps) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (disabled || reduced) { progress.stopAnimation(); progress.setValue(0); }
    return () => progress.stopAnimation();
  }, [disabled, reduced, progress]);
  const animate = (pressed: boolean) => {
    progress.stopAnimation();
    if (disabled) { progress.setValue(0); return; }
    if (reduced) { progress.setValue(pressed ? 1 : 0); return; }
    Animated.timing(progress, { toValue: pressed ? 1 : 0, duration: pressed ? motion.pressInMs : motion.releaseMs, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false }).start();
  };
  const styleState = { pressed: pressed && !disabled && !reduced, focused };
  const original = typeof style === 'function' ? style(styleState) : style;
  const flattened = StyleSheet.flatten(original);
  const opacity = typeof flattened?.opacity === 'number' ? flattened.opacity : 1;
  return <AnimatedPressable {...props} disabled={disabled}
    onPressIn={event => { setPressed(true); animate(true); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); animate(false); onPressOut?.(event); }}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[original, {
      transform: [...(Array.isArray(flattened?.transform) ? flattened.transform : []), { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : motion.pressScale] }) }],
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [opacity, opacity * motion.pressedOpacity] }),
    }]} />;
}
