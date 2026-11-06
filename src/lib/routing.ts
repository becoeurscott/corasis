import type { AuthSession, Couple, OnboardingDraft } from '@/services/backend';
import type { ThemeName } from '@/theme/tokens';

export const onboardingSteps = ['theme', 'intro', 'profile', 'relationship', 'auth', 'partner', 'couple', 'privacy', 'welcome'] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

/**
 * Decides where a returning user lands. Pure so it can be unit-tested.
 * Theme selection is always the first question for a fresh install.
 */
export function resolveStartRoute(input: { theme: ThemeName | null; onboarding: OnboardingDraft; session: AuthSession | null; couple: Couple | null; pendingInviteCode: string | null }): string {
  const { theme, onboarding: o, session, couple, pendingInviteCode } = input;
  if (!theme) return '/onboarding/theme';
  if (o.completed && session) return pendingInviteCode && !couple ? `/invite/${pendingInviteCode}` : '/(tabs)';
  if (!o.introSeen) return '/onboarding/intro';
  if (!o.firstName) return '/onboarding/profile';
  if (o.step < 3) return '/onboarding/relationship';
  if (!session) return '/onboarding/auth';
  if (!session.verified && !session.demo) return '/auth/verify';
  if (pendingInviteCode && !couple) return `/invite/${pendingInviteCode}`;
  if (o.step < 5) return '/onboarding/partner';
  if (o.step < 6) return couple ? '/onboarding/couple' : '/onboarding/privacy';
  if (o.step < 7) return '/onboarding/privacy';
  return '/onboarding/welcome';
}
