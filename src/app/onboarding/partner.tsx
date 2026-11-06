import { router } from 'expo-router';
import React from 'react';

import { InvitePanel } from '@/components/InvitePanel';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Banner } from '@/components/ui';
import { backend } from '@/services/backend';
import { useCouple, usePartner } from '@/store/hooks';

export default function PartnerStep() {
  const couple = useCouple();
  const partner = usePartner();
  const next = () => {
    backend.saveOnboarding({ step: 5 });
    router.push(couple ? '/onboarding/couple' : '/onboarding/privacy');
  };
  return (
    <OnboardingFrame step="partner" title="Connect your partner" subtitle="Share an invitation, or enter the code they sent you." onContinue={couple ? next : undefined} onSkip={couple ? undefined : next} skipTitle="I'll invite them later">
      {couple ? <Banner kind="success" title={`Connected with ${partner?.firstName ?? 'your partner'}`} body="You can manage this connection any time from Profile." /> : <InvitePanel onPaired={next} />}
    </OnboardingFrame>
  );
}
