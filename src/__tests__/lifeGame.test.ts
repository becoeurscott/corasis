import { applyAction, applyDecision, canGrow, castVote, DAY_MS, decayedNeeds, evaluate, fastForward, life, moodOf, newLifeGame, openVote, redactLifeGame, voteOptions } from '@/lib/lifeGame';
import type { LifeGame } from '@/services/backend/types';

let n = 0;
const id = (p: string) => `${p}_${++n}`;
const A = 'user_a';
const B = 'user_b';
const T0 = Date.parse('2026-01-01T00:00:00.000Z');

function born(at = T0): LifeGame {
  const g = { ...newLifeGame('life_1', 'couple_1', A, new Date(at).toISOString(), id), acceptedBy: [A, B], status: 'naming' as const };
  let v = openVote(g, 'name', 'vote_name', new Date(at).toISOString());
  v = castVote(v, A, 'mia', [A, B]);
  v = castVote(v, B, 'mia', [A, B]);
  return applyDecision({ ...g, votes: [v] }, v, at, id);
}

describe('Our Little One rules', () => {
  test('naming by matching votes starts the life', () => {
    const g = born();
    expect(g.status).toBe('alive');
    expect(g.name).toBe('Mia');
    expect(g.bornAt).toBe(new Date(T0).toISOString());
  });

  test('needs decay with real time and the mood follows', () => {
    const g = born();
    const after10h = decayedNeeds(g, T0 + 10 * 3600_000);
    expect(after10h.hunger).toBeCloseTo(80 - 4 * 10);
    expect(after10h.love).toBeCloseTo(80 - 2 * 10);
    const later = decayedNeeds(g, T0 + 40 * 3600_000);
    expect(later.hunger).toBe(0);
    expect(moodOf(later)).toBe('sad');
  });

  test('care only counts while needs are healthy', () => {
    const neglected = applyAction(born(), 'feed', A, T0 + 3 * DAY_MS, id);
    expect(neglected.care).toBe(0);
    const healthy = applyAction(born(), 'feed', A, T0 + 3600_000, id);
    expect(healthy.care).toBe(15);
    expect(healthy.log[0]).toMatchObject({ userId: A, actionId: 'feed' });
  });

  test('actions are limited to the current stage', () => {
    expect(() => applyAction(born(), 'homework', A, T0, id)).toThrow();
  });

  test('growing needs both enough care and the minimum days', () => {
    const g = { ...born(), care: 300 };
    expect(canGrow(g, T0 + 2 * DAY_MS)).toBe(false); // not enough days
    expect(canGrow({ ...g, care: 100 }, T0 + 8 * DAY_MS)).toBe(false); // not enough care
    const grown = evaluate({ ...g, needsAt: new Date(T0 + 8 * DAY_MS).toISOString() }, T0 + 8 * DAY_MS, id);
    expect(grown.stage).toBe('toddler');
    expect(grown.care).toBe(0);
  });

  test('a stage with a choice waits for the vote before growing', () => {
    let g: LifeGame = { ...born(), stage: 'child', stageStartedAt: new Date(T0).toISOString(), care: 900 };
    g = evaluate(g, T0 + 50 * DAY_MS, id);
    expect(g.stage).toBe('child');
    expect(g.votes.find((v) => v.choice === 'school')?.status).toBe('open');
  });

  test('the life ends at the one-year limit wherever the child is', () => {
    const ended = evaluate(born(), T0 + (life.maxDays + 1) * DAY_MS, id);
    expect(ended.status).toBe('ended');
    expect(ended.ending).toContain('Mia');
    expect(ended.milestones[0].kind).toBe('ended');
  });

  test('different picks go to a second round, then a coin flip', () => {
    let v = openVote(born(), 'school', 'v', new Date(T0).toISOString());
    v = castVote(v, A, 'northstar', [A, B]);
    expect(v.status).toBe('open');
    v = castVote(v, B, 'maple', [A, B]);
    expect(v.round).toBe(2);
    expect(v.previousPicks).toEqual({ [A]: 'northstar', [B]: 'maple' });
    v = castVote(v, A, 'northstar', [A, B]);
    v = castVote(v, B, 'maple', [A, B], () => 0.9);
    expect(v).toMatchObject({ status: 'decided', result: 'maple', decidedBy: 'coin' });
  });

  test('a parent cannot see the other pick before both have voted', () => {
    const g = born();
    const v = castVote(openVote(g, 'school', 'v', new Date(T0).toISOString()), A, 'northstar', [A, B]);
    const seenByB = redactLifeGame({ ...g, votes: [...g.votes, v] }, B);
    expect(seenByB.votes[1].picks[A]).toBe('hidden');
  });

  test('outsiders cannot vote', () => {
    const v = openVote(born(), 'school', 'v', new Date(T0).toISOString());
    expect(() => castVote(v, 'stranger', 'maple', [A, B])).toThrow();
  });

  test('job options follow the strongest skills', () => {
    const g = { ...born(), skills: { smart: 2, kind: 1, creative: 30, sporty: 0 } };
    expect(voteOptions(g, 'job').slice(0, 2)).toEqual(['designer', 'chef']);
  });

  test('fast-forward moves the clock and grows a well-cared-for child', () => {
    const g = fastForward(born(Date.now()), 8, Date.now(), id);
    expect(g.clockOffsetMs).toBe(8 * DAY_MS);
    expect(g.stage).toBe('toddler');
  });
});
