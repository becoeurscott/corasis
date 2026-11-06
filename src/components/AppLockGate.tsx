import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { useLock } from '@/store/lock';

/**
 * Shows the lock screen on cold start and when the app returns from the
 * background. Note: this protects app re-entry and (on native) the switcher
 * preview; it does not encrypt stored data or replace backend authorization.
 */
export function AppLockGate() {
  const enabled = usePrefs((s) => s.appLockEnabled);
  const session = useSession();
  const locked = useLock((s) => s.locked);
  const setLocked = useLock((s) => s.setLocked);
  const pathname = usePathname();
  const last = useRef(AppState.currentState);

  useEffect(() => {
    if (!enabled || !session) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (last.current && /active/.test(last.current) && /inactive|background/.test(next)) setLocked(true);
      last.current = next;
    });
    return () => sub.remove();
  }, [enabled, session, setLocked]);

  useEffect(() => {
    if (enabled && session && locked && pathname !== '/lock') router.push('/lock');
  }, [enabled, session, locked, pathname]);

  return null;
}
