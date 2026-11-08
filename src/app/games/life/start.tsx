import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Baby } from '@/components/game/Baby';
import { VotePanel } from '@/components/game/VotePanel';
import { Banner, Button, Gradient, Header, Screen, toast, Txt } from '@/components/ui';
import { currentVote, life } from '@/lib/lifeGame';
import { backend, BackendError } from '@/services/backend';
import { useCouple, useLifeGame, useMe, usePartner } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

/** Propose → partner accepts → both name the baby. Once named, the life starts in the room. */
export default function LifeStart() {
  const me = useMe();
  const partner = usePartner();
  const couple = useCouple();
  const game = useLifeGame();
  const [busy, setBusy] = useState(false);
  const partnerName = partner?.firstName ?? 'your partner';

  if (game?.status === 'alive') return <Redirect href="/games/life" />;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof BackendError ? e.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const vote = game ? currentVote(game) : null;
  const fresh = !game || game.status === 'ended';

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Our Little One" />
      <View style={{ gap: spacing.lg }}>
        {game?.status === 'naming' && vote ? (
          <>
            <Gradient colors={['#BFE0FF', '#7FB8FF']} style={{ borderRadius: 28, alignItems: 'center', paddingTop: spacing.lg }}>
              <Baby look={life.stages[0].look} mood="happy" size={200} />
            </Gradient>
            <VotePanel game={game} vote={vote} />
          </>
        ) : (
          <>
            <Gradient colors={['#BFE0FF', '#7FB8FF']} style={{ borderRadius: 28, alignItems: 'center', paddingTop: spacing.xl }}>
              <Baby look={life.stages[0].look} mood={game?.status === 'proposed' ? 'happy' : 'sleepy'} size={220} />
            </Gradient>
            <View style={{ gap: spacing.sm }}>
              <Txt variant="title">{fresh ? 'Raise a little one together' : game?.proposedBy === me?.id ? `Waiting for ${partnerName}` : `${partnerName} wants a baby with you 💞`}</Txt>
              <Txt tone="secondary">
                {fresh
                  ? `Feed, bathe, play and put them to bed. Vote together on their name, school, path, job and who they marry. They grow up as you care for them, and their whole life fits in one year.`
                  : game?.proposedBy === me?.id
                    ? `You proposed having a baby. Once ${partnerName} says yes, you’ll both pick a name.`
                    : `Say yes and you’ll both pick a name in secret. Raising them is a team effort: needs drop over real time, so check in every day.`}
              </Txt>
            </View>
            {!couple || !partner ? <Banner kind="info" body="Connect with your partner first. A baby needs two parents." actionTitle="Invite partner" onAction={() => router.push('/settings/partner')} /> : null}
            {partner?.isSimulated && fresh ? <Banner kind="demo" body={`${partnerName} is a simulated partner in this demo and will answer for themselves.`} /> : null}
            {fresh ? <Button title="Propose having a baby" onPress={() => run(() => backend.proposeBaby())} loading={busy} disabled={!partner} /> : null}
            {game?.status === 'proposed' && game.proposedBy !== me?.id ? (
              <View style={{ gap: spacing.sm }}>
                <Button title="Yes, let’s do it" onPress={() => run(() => backend.respondToBaby(true))} loading={busy} />
                <Button title="Not now" variant="ghost" onPress={() => run(async () => { await backend.respondToBaby(false); router.back(); })} />
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
