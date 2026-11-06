import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { backend, useData } from '@/services/backend';

/**
 * Handles incoming links: together://invite/CODE and https://…/invite/CODE.
 * If the user is not ready (no session / mid-onboarding) the code is kept as
 * pending context and applied once pairing is possible.
 */
export function DeepLinkHandler() {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const path = (parsed.path ?? '').replace(/^\/+/, '');
      const m = path.match(/^invite\/([A-Za-z0-9]+)/);
      if (m) {
        const code = m[1].toUpperCase();
        const { session, onboarding } = useData.getState();
        backend.setPendingInvite(code);
        if (session && onboarding.completed) router.push(`/invite/${code}`);
        return;
      }
      if (/^(question|messages|memories|meetings)\b/.test(path)) {
        const { session, onboarding } = useData.getState();
        if (session && onboarding.completed && backend.couple()) {
          if (path.startsWith('question')) router.push('/activity/daily');
          else if (path.startsWith('messages')) router.push('/messages');
          else if (path.startsWith('memories')) router.push('/(tabs)/memories');
          else router.push('/meetings');
        }
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);
  return null;
}
