import { backend, BackendError, cancelSimulations, useData } from '@/services/backend';
import { resolveStartRoute } from '@/lib/routing';
import { emptyOnboarding } from '@/services/backend/local';

const media = () => ({ id: `m${Math.random()}`, kind: 'photo' as const, uri: 'file://x', uploadState: 'uploaded' as const, createdAt: new Date().toISOString() });

async function twoAccounts() {
  await backend.resetAll();
  backend.saveOnboarding({ firstName: 'Ada', timezone: 'Europe/Paris' });
  const a = await backend.signUp('ada@example.com', 'password123');
  await backend.verifyEmail(a.verificationCode);
  const inv = await backend.createInvitation();
  await backend.signOut();
  backend.saveOnboarding({ firstName: 'Bo', timezone: 'America/Montreal' });
  const b = await backend.signUp('bo@example.com', 'password123');
  await backend.verifyEmail(b.verificationCode);
  return { inv, adaId: useData.getState().accounts[0].id, boId: useData.getState().accounts[1].id };
}

afterEach(() => cancelSimulations());

describe('authentication', () => {
  it('rejects weak passwords and duplicate emails', async () => {
    await backend.resetAll();
    await expect(backend.signUp('a@b.co', 'short')).rejects.toBeInstanceOf(BackendError);
    await backend.signUp('a@b.co', 'longenough');
    await backend.signOut();
    await expect(backend.signUp('A@B.co', 'longenough')).rejects.toMatchObject({ code: 'exists' });
    await expect(backend.signIn('a@b.co', 'wrong')).rejects.toMatchObject({ code: 'bad_credentials' });
  });
  it('resets a password with a code and does not reveal missing accounts', async () => {
    await backend.resetAll();
    await backend.signUp('a@b.co', 'longenough');
    await backend.signOut();
    expect((await backend.requestPasswordReset('nobody@b.co')).resetCode).toBeNull();
    const { resetCode } = await backend.requestPasswordReset('a@b.co');
    await backend.resetPassword('a@b.co', resetCode!, 'newpassword1');
    await expect(backend.signIn('a@b.co', 'newpassword1')).resolves.toMatchObject({ email: 'a@b.co' });
  });
});

describe('pairing', () => {
  it('pairs two accounts through a single-use invitation and rejects reuse', async () => {
    const { inv, adaId, boId } = await twoAccounts();
    const preview = await backend.previewInvitation(inv.code);
    expect(preview.reason).toBe('ok');
    expect(preview.invitation?.inviterName).toBe('Ada');
    const couple = await backend.acceptInvitation(inv.code);
    expect(couple.memberIds.sort()).toEqual([adaId, boId].sort());
    await backend.signOut();
    backend.saveOnboarding({ firstName: 'Cy' });
    const c = await backend.signUp('cy@example.com', 'password123');
    await backend.verifyEmail(c.verificationCode);
    await expect(backend.acceptInvitation(inv.code)).rejects.toMatchObject({ code: 'used' });
    await expect(backend.acceptInvitation('ZZZZZZ')).rejects.toMatchObject({ code: 'invalid' });
  });
  it('rejects expired, revoked and self invitations', async () => {
    await backend.resetAll();
    backend.saveOnboarding({ firstName: 'Ada' });
    const a = await backend.signUp('ada@example.com', 'password123');
    await backend.verifyEmail(a.verificationCode);
    const inv = await backend.createInvitation();
    expect((await backend.previewInvitation(inv.code)).reason).toBe('self');
    await backend.revokeInvitation(inv.id);
    expect((await backend.previewInvitation(inv.code)).reason).toBe('revoked');
    const inv2 = await backend.createInvitation();
    useData.setState({ invitations: useData.getState().invitations.map((i) => (i.id === inv2.id ? { ...i, expiresAt: new Date(Date.now() - 1000).toISOString() } : i)) });
    expect((await backend.previewInvitation(inv2.code)).reason).toBe('expired');
  });
  it('enforces two members per couple', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code);
    await expect(backend.createInvitation()).rejects.toMatchObject({ code: 'already_paired' });
  });
});

describe('streak and moments', () => {
  it('validates a day exactly once with idempotent submissions', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code); // Bo is signed in
    await backend.addMoment(media(), null, 'req-1');
    await backend.addMoment(media(), null, 'req-1'); // retry → no duplicate
    expect(backend.momentsFor(backend.couple()!.id)).toHaveLength(1);
    expect(backend.streak()!.current).toBe(0);
    await backend.signOut();
    await backend.signIn('ada@example.com', 'password123');
    await backend.addMoment(media(), 'hi', 'req-2');
    await backend.addMoment(media(), 'again', 'req-3'); // extra moment, no extra credit
    expect(backend.streak()!.current).toBe(1);
    expect(backend.streak()!.longest).toBe(1);
  });
});

describe('activities', () => {
  it('hides the partner answer until both submit and locks after reveal', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code); // Bo
    const s = await backend.startSession('deck_daily', 'gk1');
    await backend.submit(s.id, 'Bo answer', null);
    await backend.signOut();
    await backend.signIn('ada@example.com', 'password123');
    const seenByAda = backend.session(s.id)!;
    expect(seenByAda.status).toBe('waiting');
    expect(seenByAda.submissions).toHaveLength(0); // Bo's answer is redacted
    expect(JSON.stringify(backend.sessions())).not.toContain('Bo answer');
    const revealed = await backend.submit(s.id, 'Ada answer', 'a comment');
    expect(revealed.status).toBe('revealed');
    expect(revealed.submissions.map((x) => x.answer).sort()).toEqual(['Ada answer', 'Bo answer']);
    await expect(backend.submit(s.id, 'changed', null)).rejects.toMatchObject({ code: 'locked' });
  });
  it('resumes an open session instead of duplicating it, and allows skips', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code);
    const s1 = await backend.startSession('deck_gk', 'gk2');
    const s2 = await backend.startSession('deck_gk', 'gk2');
    expect(s2.id).toBe(s1.id);
    const after = await backend.submit(s1.id, '', null, true);
    expect(after.submissions[0].skipped).toBe(true);
    await expect(backend.submit(s1.id, 'x', null)).rejects.toMatchObject({ code: 'duplicate' });
  });
  it('blocks access to sessions of another couple', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code);
    const s = await backend.startSession('deck_daily', 'gk1');
    await backend.signOut();
    backend.saveOnboarding({ firstName: 'Cy' });
    const c = await backend.signUp('cy@example.com', 'password123');
    await backend.verifyEmail(c.verificationCode);
    expect(() => backend.session(s.id)).toThrow(BackendError);
    await expect(backend.submit(s.id, 'leak', null)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('sharing and unlinking', () => {
  it('revokes live info when sharing is turned off', async () => {
    const { inv, boId } = await twoAccounts();
    await backend.acceptInvitation(inv.code); // Bo
    await backend.setSharing({ location: true, battery: true });
    await backend.pushLive({ lat: 45.5, lon: -73.5, city: 'Montréal', batteryPercent: 50 });
    expect(backend.liveFor(boId)?.lat).toBe(45.5);
    await backend.setSharing({ location: false });
    expect(backend.liveFor(boId)?.lat).toBeNull();
    expect(backend.liveFor(boId)?.batteryPercent).toBe(50);
    await backend.setSharing({ battery: false });
    expect(backend.liveFor(boId)?.batteryPercent).toBeNull();
  });
  it('ignores pushes while sharing is off', async () => {
    const { inv, boId } = await twoAccounts();
    await backend.acceptInvitation(inv.code);
    await backend.pushLive({ lat: 1, lon: 2 });
    expect(backend.liveFor(boId)).toBeNull();
  });
  it('unlinking removes access to couple resources', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code);
    await backend.addMoment(media(), null, 'r1');
    await backend.sendMessage({ kind: 'text', text: 'hey', clientRequestId: 'm1' });
    await backend.unlink();
    expect(backend.couple()).toBeNull();
    expect(backend.messages()).toHaveLength(0);
    expect(backend.memories()).toHaveLength(0);
    await expect(backend.addMoment(media(), null, 'r2')).rejects.toMatchObject({ code: 'not_paired' });
  });
  it('only the owner can delete a memory', async () => {
    const { inv } = await twoAccounts();
    await backend.acceptInvitation(inv.code); // Bo
    const mem = await backend.addMemory({ kind: 'letter', media: null, title: 't', body: 'b', caption: null, takenOn: '2026-01-01' });
    await backend.signOut();
    await backend.signIn('ada@example.com', 'password123');
    await expect(backend.deleteMemory(mem.id)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('start routing', () => {
  it('always starts at theme selection on a fresh install', () => {
    expect(resolveStartRoute({ theme: null, onboarding: emptyOnboarding, session: null, couple: null, pendingInviteCode: null })).toBe('/onboarding/theme');
  });
  it('resumes interrupted onboarding at the right step', () => {
    expect(resolveStartRoute({ theme: 'pink', onboarding: { ...emptyOnboarding, introSeen: true }, session: null, couple: null, pendingInviteCode: null })).toBe('/onboarding/profile');
    expect(resolveStartRoute({ theme: 'pink', onboarding: { ...emptyOnboarding, introSeen: true, firstName: 'A', step: 3 }, session: null, couple: null, pendingInviteCode: null })).toBe('/onboarding/auth');
    const session = { userId: 'u', email: 'e', verified: true, demo: false };
    expect(resolveStartRoute({ theme: 'pink', onboarding: { ...emptyOnboarding, introSeen: true, firstName: 'A', step: 4 }, session, couple: null, pendingInviteCode: null })).toBe('/onboarding/partner');
    expect(resolveStartRoute({ theme: 'pink', onboarding: { ...emptyOnboarding, completed: true }, session, couple: null, pendingInviteCode: null })).toBe('/(tabs)');
    expect(resolveStartRoute({ theme: 'pink', onboarding: { ...emptyOnboarding, completed: true }, session, couple: null, pendingInviteCode: 'ABC123' })).toBe('/invite/ABC123');
  });
});
