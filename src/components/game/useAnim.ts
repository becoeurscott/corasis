import { useState } from 'react';
import { Animated } from 'react-native';

/** A stable Animated.Value for the life of the component. Works on web, unlike useAnimatedValue. */
export function useAnim(initial = 0): Animated.Value {
  return useState(() => new Animated.Value(initial))[0];
}
