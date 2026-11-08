import { connectionFlow, connectionRecommendation, validateConnectionAnswers } from '@/lib/connectionPreferences';
import { resolveStartRoute } from '@/lib/routing';
import { backend, cancelSimulations, emptyOnboarding, useData } from '@/services/backend';

afterEach(() => cancelSimulations());

it('validates shared option IDs and accepts skipping every question', () => {
  expect(validateConnectionAnswers({})).toEqual({});
  expect(() => validateConnectionAnswers({ diagnosis: 'anything' })).toThrow();
  expect(() => validateConnectionAnswers({ pace: 'unknown' })).toThrow();
  for (const q of connectionFlow.questions) for (const option of q.options) expect(validateConnectionAnswers({ [q.id]: option.id })).toEqual({ [q.id]: option.id });
});
it('recommends an appropriate first deck and time without creating a daily target', () => {
  const prefs = { version: 1, completed: true, updatedAt: '', answers: { focus: 'deeper_conversations', pace: 'gentle', daily_time: 'two_minutes' } };
  expect(connectionRecommendation(prefs)).toMatchObject({ deck: { id: 'deck_ev' }, duration: 'About 2 minutes · one prompt is enough' });
  expect(connectionRecommendation({ ...prefs, answers: { focus: 'deeper_conversations' } })?.deck.id).toBe('deck_dp');
  expect(connectionRecommendation({ ...prefs, answers: {} })).toBeNull();
});
it('routes fresh users through the optional questions and resumes the saved draft', () => {
  const input = { theme: 'pink' as const, onboarding: { ...emptyOnboarding, introSeen: true, firstName: 'Ada', step: 4 }, session: null, couple: null, pendingInviteCode: null };
  expect(resolveStartRoute(input)).toBe('/onboarding/connection');
  expect(resolveStartRoute({ ...input, onboarding: { ...input.onboarding, connectionDraft: { version: 1, completed: true, answers: {}, updatedAt: '' } } })).toBe('/onboarding/auth');
});
it('attaches pre-account answers to the new user and keeps two accounts isolated', async () => {
  await backend.resetAll();
  backend.saveConnectionDraft({ focus: 'appreciation' }, true);
  const signup = await backend.signUp('ada@example.com', 'password123');
  await backend.verifyEmail(signup.verificationCode!);
  const ada = useData.getState().session!.userId;
  expect(backend.connectionPreferences()?.answers.focus).toBe('appreciation');
  await backend.signOut();
  const second = await backend.signUp('bo@example.com', 'password123');
  await backend.verifyEmail(second.verificationCode!);
  expect(backend.connectionPreferences()).toBeNull();
  await backend.saveConnectionPreferences({ pace: 'playful' });
  const exported = JSON.parse(backend.exportData());
  expect(exported.connectionPreferences.answers).toEqual({ pace: 'playful' });
  expect(JSON.stringify(exported)).not.toContain('appreciation');
  expect(useData.getState().connectionPreferences[ada].answers.focus).toBe('appreciation');
  await backend.signOut(); await backend.signIn('ada@example.com', 'password123');
  expect(backend.connectionPreferences()?.answers.focus).toBe('appreciation');
  await backend.saveConnectionPreferences({});
  expect(backend.connectionPreferences()?.answers).toEqual({});
});
it('stores demo answers locally and removes preferences on account deletion', async () => {
  await backend.resetAll(); backend.saveConnectionDraft({ affection: 'words' }, true);
  await backend.startDemo();
  expect(backend.connectionPreferences()?.answers.affection).toBe('words');
  const id = useData.getState().session!.userId;
  await backend.deleteAccount();
  expect(useData.getState().connectionPreferences[id]).toBeUndefined();
});
it('rejects invalid answers without changing saved preferences', async () => {
  await backend.resetAll(); await backend.startDemo();
  await backend.saveConnectionPreferences({ pace: 'gentle' });
  await expect(backend.saveConnectionPreferences({ pace: 'made_up' })).rejects.toThrow();
  expect(backend.connectionPreferences()?.answers).toEqual({ pace: 'gentle' });
});
