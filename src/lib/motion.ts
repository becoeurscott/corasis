import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

import product from '../../shared/product.json';
import { usePrefs } from '@/store/prefs';

export const motion = product.motion;
let systemReducedMotion = true;
let generation = 0;
const listeners = new Set<() => void>();
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
function publish(value: boolean) {
  if (systemReducedMotion === value) return;
  systemReducedMotion = value; listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const current = ++generation;
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { generation += 1; publish(value); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (generation === current && listeners.size) publish(value); }).catch(() => {});
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { generation += 1; subscription?.remove(); subscription = undefined; systemReducedMotion = true; }
  };
}
/** One device listener for the whole app; disable motion until its preference is known. */
export function useReducedMotion() {
  const preference = usePrefs(s => s.reduceMotion);
  const system = useSyncExternalStore(subscribe, () => systemReducedMotion, () => true);
  return preference || system;
}
/** Fade the new question in while keeping its footer and hit targets in place. */
export function useStepFade(step: number) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const previous = useRef(step);
  useEffect(() => {
    const changed = previous.current !== step;
    previous.current = step;
    opacity.stopAnimation();
    if (reduced || !changed) { opacity.setValue(1); return; }
    opacity.setValue(0.6);
    const animation = Animated.timing(opacity, { toValue: 1, duration: motion.transitionMs, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [step, reduced, opacity]);
  return opacity;
}
