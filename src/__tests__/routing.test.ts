import { resolveStartRoute } from '@/lib/routing';

const base = { introSeen: true, firstName: 'Sam', step: 4, completed: false, connectionDraft: { completed: true } } as never;
const session = { userId: 'u1', email: 'a@b.c', verified: true, demo: false };

describe('after the email code', () => {
  it('sends a new person to the partner invite before home', () => {
    expect(resolveStartRoute({ theme: 'pink', onboarding: base, session, couple: null, pendingInviteCode: null })).toBe('/onboarding/partner');
  });
  it('sends someone who finished onboarding straight home', () => {
    expect(resolveStartRoute({ theme: 'pink', onboarding: { ...(base as object), completed: true } as never, session, couple: null, pendingInviteCode: null })).toBe('/(tabs)');
  });
});
