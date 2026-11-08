import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';

import { ConnectionQuestions } from '@/components/ConnectionQuestions';
import { Banner, Button, Header, Screen, toast } from '@/components/ui';
import { backend } from '@/services/backend';
import { useConnectionPreferences, useSession } from '@/store/hooks';

export default function ConnectionSettings() {
  const preferences = useConnectionPreferences();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  const session = useSession();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clear = async () => { setBusy(true); setError(''); try { await backend.saveConnectionPreferences({}); setRevision(revision + 1); toast('Your connection answers were cleared.', 'success'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Screen scrollRef={scrollRef}><Header title="Your connection preferences" />
    {session?.demo ? <Banner kind="demo" body="Demo preferences stay on this device. Account preferences are saved privately to your account." /> : null}
    <ConnectionQuestions onStepChange={scrollToTop} key={revision} initial={preferences?.answers ?? {}} finishTitle="Save my preferences" onFinish={async answers => { await backend.saveConnectionPreferences(answers); toast('Your preferences are saved.', 'success'); router.back(); }} />
    <Button title="Clear my answers" variant="ghost" onPress={clear} loading={busy} />
    {error ? <Banner kind="danger" body={error} /> : null}
  </Screen>;
}
