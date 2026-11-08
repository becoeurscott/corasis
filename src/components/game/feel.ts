import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { haptic } from '@/lib/haptics';

/**
 * Feedback tiers from the game-feel skill: every event picks a tier so juice stays proportional.
 * small = a toy or a poke, medium = a care action lands, large = the child grows up.
 */
export type FeelTier = 'small' | 'medium' | 'large';

export const tiers: Record<FeelTier, { trauma: number; haptic: Parameters<typeof haptic>[0]; flash: boolean; particles: number }> = {
  small: { trauma: 0, haptic: 'light', flash: false, particles: 3 },
  medium: { trauma: 0.25, haptic: 'success', flash: false, particles: 8 },
  large: { trauma: 0.8, haptic: 'success', flash: true, particles: 18 },
};

/** True when the person asked the system to reduce motion: we then skip shake and flashes. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Ease-out-back: shoots ~10% past the target and settles. Used for "pop" moments. */
export const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const m = k - 1;
  return 1 + c3 * m * m * m + c1 * m * m;
};
