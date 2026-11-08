/**
 * "Our Little One" rules, kept free of React and storage so both the backend and the tests use them.
 * The SwiftUI app implements the same rules in native-ios/Together/LifeGame.swift; keep the two in sync.
 */
import product from '../../shared/product.json';
import type { ID, LifeChoiceId, LifeGame, LifeNeed, LifeSkill, LifeStageId, LifeVote } from '@/services/backend/types';

export interface LifeNeedDef { id: LifeNeed; label: string; emoji: string; decayPerHour: number }
export interface LifeSkillDef { id: LifeSkill; label: string; emoji: string }
export interface LifeActionDef { id: string; label: string; emoji: string; verb: string; effects: Partial<Record<LifeNeed, number>>; care: number; skills: Partial<Record<LifeSkill, number>> }
export interface LifeLook { scale: number; hair: 'none' | 'tuft' | 'short' | 'long' | 'grey'; accessory: 'none' | 'pacifier' | 'backpack' | 'headphones' | 'tie' | 'ring' | 'glasses'; outfit: string }
export interface LifeStageDef { id: LifeStageId; label: string; minDays: number; careToGrow: number; actions: string[]; choice: LifeChoiceId | null; look: LifeLook }
export interface LifeOption { id: string; label: string; emoji: string; skills?: Partial<Record<LifeSkill, number>>; skill?: LifeSkill }
export interface LifeChoiceDef { title: string; prompt: string; pick?: number; options: LifeOption[] }
export interface LifeContent {
  maxDays: number;
  careThreshold: number;
  coinFlipRound: number;
  needs: LifeNeedDef[];
  skills: LifeSkillDef[];
  actions: LifeActionDef[];
  stages: LifeStageDef[];
  choices: Record<LifeChoiceId, LifeChoiceDef>;
  endings: { complete: string; early: string; traits: Record<LifeSkill, string> };
}

export const life = product.lifeGame as unknown as LifeContent;
export const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const stageDef = (id: LifeStageId) => life.stages.find((s) => s.id === id)!;
export const actionDef = (id: string) => life.actions.find((a) => a.id === id);
export const choiceDef = (id: LifeChoiceId) => life.choices[id];
export const optionLabel = (choice: LifeChoiceId, id: string | null | undefined) => life.choices[choice].options.find((o) => o.id === id)?.label ?? id ?? '';

const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const fill = (name: string | null, text: string, stage?: string) => text.replace(/\{name\}/g, name ?? 'your little one').replace(/\{stage\}/g, (stage ?? '').toLowerCase());

/** The game's "now": real time plus any demo fast-forward. */
export function gameNow(game: Pick<LifeGame, 'clockOffsetMs'>, realNow = Date.now()) {
  return realNow + (game.clockOffsetMs ?? 0);
}

export function freshNeeds(value = 80): Record<LifeNeed, number> {
  return { hunger: value, energy: value, hygiene: value, fun: value, love: value };
}
export function freshSkills(): Record<LifeSkill, number> {
  return { smart: 0, kind: 0, creative: 0, sporty: 0 };
}

/** Needs after real time has passed since they were last updated. Needs never decay before birth or after the end. */
export function decayedNeeds(game: LifeGame, now: number): Record<LifeNeed, number> {
  if (game.status !== 'alive') return game.needs;
  const hours = Math.max(0, (now - Date.parse(game.needsAt)) / HOUR_MS);
  const out = { ...game.needs };
  for (const n of life.needs) out[n.id] = clamp(out[n.id] - n.decayPerHour * hours);
  return out;
}

export const averageNeed = (needs: Record<LifeNeed, number>) => life.needs.reduce((sum, n) => sum + needs[n.id], 0) / life.needs.length;

export type LifeMood = 'happy' | 'hungry' | 'sleepy' | 'dirty' | 'bored' | 'lonely' | 'sad';
export function moodOf(needs: Record<LifeNeed, number>): LifeMood {
  if (averageNeed(needs) < life.careThreshold) return 'sad';
  const lowest = life.needs.reduce((a, b) => (needs[b.id] < needs[a.id] ? b : a));
  if (needs[lowest.id] >= 35) return 'happy';
  return ({ hunger: 'hungry', energy: 'sleepy', hygiene: 'dirty', fun: 'bored', love: 'lonely' } as const)[lowest.id];
}

export const ageDays = (game: LifeGame, now: number) => (game.bornAt ? (now - Date.parse(game.bornAt)) / DAY_MS : 0);
export const daysInStage = (game: LifeGame, now: number) => (game.stageStartedAt ? (now - Date.parse(game.stageStartedAt)) / DAY_MS : 0);

/** The choice the current stage needs before the child can grow, if it hasn't been decided yet. */
export function pendingChoice(game: LifeGame): LifeChoiceId | null {
  const c = stageDef(game.stage).choice;
  return c && !game.decisions[c] ? c : null;
}

export function canGrow(game: LifeGame, now: number): boolean {
  if (game.status !== 'alive') return false;
  const st = stageDef(game.stage);
  return game.care >= st.careToGrow && daysInStage(game, now) >= st.minDays && !pendingChoice(game);
}

/** Growth progress 0..1 combining care and time, for the progress bar. */
export function growthProgress(game: LifeGame, now: number) {
  const st = stageDef(game.stage);
  return Math.min(1, game.care / st.careToGrow) * 0.7 + Math.min(1, daysInStage(game, now) / st.minDays) * 0.3;
}

/** Options shown for a choice. Jobs are narrowed to the ones that fit the child's strongest skills. */
export function voteOptions(game: LifeGame, choice: LifeChoiceId): string[] {
  const def = life.choices[choice];
  if (choice !== 'job') return def.options.map((o) => o.id);
  const ranked = def.options.map((o, i) => ({ o, i, score: o.skill ? game.skills[o.skill] : 0 })).sort((a, b) => b.score - a.score || a.i - b.i);
  return ranked.slice(0, def.pick ?? 3).map((r) => r.o.id);
}

export function openVote(game: LifeGame, choice: LifeChoiceId, id: ID, nowIso: string): LifeVote {
  return { id, choice, options: voteOptions(game, choice), round: 1, picks: {}, previousPicks: null, status: 'open', result: null, decidedBy: null, openedAt: nowIso };
}

/**
 * Records one parent's secret pick. When both have picked: a match decides it; a mismatch starts
 * another round; on the coin-flip round a mismatch is settled at random between the two picks.
 */
export function castVote(vote: LifeVote, userId: ID, optionId: string, memberIds: ID[], rand = Math.random): LifeVote {
  if (vote.status === 'decided') throw new Error('This choice is already decided.');
  if (!vote.options.includes(optionId)) throw new Error('That option is not available.');
  if (!memberIds.includes(userId)) throw new Error('Only the two parents can vote.');
  const picks = { ...vote.picks, [userId]: optionId };
  if (!memberIds.every((m) => picks[m])) return { ...vote, picks };
  const [a, b] = memberIds.map((m) => picks[m]);
  if (a === b) return { ...vote, picks, status: 'decided', result: a, decidedBy: 'match' };
  if (vote.round >= life.coinFlipRound) return { ...vote, picks, status: 'decided', result: rand() < 0.5 ? a : b, decidedBy: 'coin' };
  return { ...vote, round: vote.round + 1, previousPicks: picks, picks: {} };
}

/** Hide the partner's pick until both parents have picked in this round. */
export function redactLifeGame(game: LifeGame, viewerId: ID): LifeGame {
  return {
    ...game,
    votes: game.votes.map((v) => (v.status === 'decided' ? v : { ...v, picks: Object.fromEntries(Object.entries(v.picks).map(([k, val]) => [k, k === viewerId ? val : 'hidden'])) })),
  };
}

export const currentVote = (game: LifeGame) => game.votes.find((v) => v.status === 'open') ?? null;
export const stageActions = (game: LifeGame) => stageDef(game.stage).actions.map((id) => actionDef(id)!).filter(Boolean);

export function endingText(game: LifeGame, complete: boolean): string {
  const top = (Object.keys(game.skills) as LifeSkill[]).reduce((a, b) => (game.skills[b] > game.skills[a] ? b : a));
  const base = fill(game.name, complete ? life.endings.complete : life.endings.early, stageDef(game.stage).label);
  return game.skills[top] > 0 ? `${base} ${life.endings.traits[top]}` : base;
}

type MakeId = (prefix: string) => ID;

/** Apply a care action: refresh decay, apply effects, earn care points (only while needs are healthy) and skills. */
export function applyAction(game: LifeGame, actionId: string, userId: ID, now: number, makeId: MakeId): LifeGame {
  if (game.status !== 'alive') throw new Error('Your little one isn’t here to look after right now.');
  if (!stageDef(game.stage).actions.includes(actionId)) throw new Error('That isn’t something they need at this age.');
  const a = actionDef(actionId)!;
  const needs = decayedNeeds(game, now);
  for (const [k, v] of Object.entries(a.effects)) needs[k as LifeNeed] = clamp(needs[k as LifeNeed] + (v ?? 0));
  const healthy = averageNeed(needs) >= life.careThreshold;
  const skills = { ...game.skills };
  for (const [k, v] of Object.entries(a.skills)) skills[k as LifeSkill] += v ?? 0;
  const iso = new Date(now).toISOString();
  return {
    ...game,
    needs,
    needsAt: iso,
    care: healthy ? game.care + a.care : game.care,
    skills,
    log: [{ id: makeId('care'), userId, actionId, at: iso }, ...game.log].slice(0, 60),
  };
}

/** Resolve a decided vote into the game: naming starts the life, other choices shape skills and the story. */
export function applyDecision(game: LifeGame, vote: LifeVote, now: number, makeId: MakeId): LifeGame {
  if (vote.status !== 'decided' || !vote.result) return game;
  const iso = new Date(now).toISOString();
  const opt = life.choices[vote.choice].options.find((o) => o.id === vote.result)!;
  const skills = { ...game.skills };
  for (const [k, v] of Object.entries(opt.skills ?? {})) skills[k as LifeSkill] += v ?? 0;
  if (opt.skill) skills[opt.skill] += 10;
  const how = vote.decidedBy === 'coin' ? ' (a coin flip settled it)' : '';
  let next: LifeGame = { ...game, skills, decisions: { ...game.decisions, [vote.choice]: vote.result } };
  if (vote.choice === 'name') {
    return {
      ...next,
      name: opt.label,
      status: 'alive',
      bornAt: iso,
      stageStartedAt: iso,
      needs: freshNeeds(80),
      needsAt: iso,
      milestones: [{ id: makeId('ms'), kind: 'born', text: `${opt.label} was born${how}. Welcome to the world! 🍼`, at: iso }, ...next.milestones],
    };
  }
  const text = {
    school: `${next.name} started at ${opt.label}${how}. 🎒`,
    hobby: `${next.name} found a passion: ${opt.label.toLowerCase()}${how}.`,
    job: `${next.name} got their first job as a ${opt.label.toLowerCase()}${how}. 💼`,
    partner: `${next.name} fell in love with ${opt.label.split(',')[0]}${how}.`,
  }[vote.choice as Exclude<LifeChoiceId, 'name'>];
  next = { ...next, milestones: [{ id: makeId('ms'), kind: 'choice', text, at: iso }, ...next.milestones] };
  if (vote.choice === 'partner') next = { ...next, milestones: [{ id: makeId('ms'), kind: 'wedding', text: `Wedding day! ${next.name} and ${opt.label.split(',')[0]} got married. 💍`, at: iso }, ...next.milestones] };
  return next;
}

/**
 * Bring the game up to date at `now`: decay needs, end the life at the one-year limit, grow through
 * every stage whose conditions are met, and open the vote a new stage needs.
 */
export function evaluate(game: LifeGame, now: number, makeId: MakeId): LifeGame {
  if (game.status !== 'alive') return game;
  const iso = new Date(now).toISOString();
  let g: LifeGame = { ...game, needs: decayedNeeds(game, now), needsAt: iso };
  const end = (complete: boolean): LifeGame => ({ ...g, status: 'ended', endedAt: iso, ending: endingText(g, complete), votes: g.votes.filter((v) => v.status === 'decided'), milestones: [{ id: makeId('ms'), kind: 'ended', text: complete ? `${g.name} lived a full life. 🕊️` : `A year has passed. ${g.name}'s story ends here.`, at: iso }, ...g.milestones] });
  if (ageDays(g, now) >= life.maxDays) return end(g.stage === 'elder');
  while (canGrow(g, now)) {
    const i = life.stages.findIndex((s) => s.id === g.stage);
    if (i === life.stages.length - 1) return end(true);
    const next = life.stages[i + 1];
    g = { ...g, stage: next.id, stageStartedAt: iso, care: 0, milestones: [{ id: makeId('ms'), kind: 'grew', text: `${g.name} is now ${next.id === 'partnered' ? 'a grown-up looking for love' : `${/^[aeiou]/i.test(next.label) ? 'an' : 'a'} ${next.label.toLowerCase()}`}! 🎉`, at: iso }, ...g.milestones] };
  }
  const choice = pendingChoice(g);
  if (choice && !g.votes.some((v) => v.choice === choice)) g = { ...g, votes: [...g.votes, openVote(g, choice, makeId('vote'), iso)] };
  return g;
}

/**
 * Demo-only: move the game clock forward as if both parents had cared well the whole time,
 * so every stage can be tried without waiting months.
 */
export function fastForward(game: LifeGame, days: number, realNow: number, makeId: MakeId): LifeGame {
  if (game.status !== 'alive') return game;
  const offset = (game.clockOffsetMs ?? 0) + days * DAY_MS;
  const now = realNow + offset;
  const skills = { ...game.skills };
  for (const s of life.skills) skills[s.id] += Math.round(days * 0.5);
  const st = stageDef(game.stage);
  const care = Math.min(game.care + days * 130, st.careToGrow);
  return evaluate({ ...game, clockOffsetMs: offset, needs: freshNeeds(85), needsAt: new Date(now).toISOString(), care, skills }, now, makeId);
}

export function newLifeGame(id: ID, coupleId: ID, proposedBy: ID, nowIso: string, makeId: MakeId): LifeGame {
  return {
    id,
    coupleId,
    status: 'proposed',
    proposedBy,
    acceptedBy: [proposedBy],
    name: null,
    bornAt: null,
    stage: 'newborn',
    stageStartedAt: null,
    needs: freshNeeds(80),
    needsAt: nowIso,
    care: 0,
    skills: freshSkills(),
    decisions: {},
    votes: [],
    log: [],
    milestones: [{ id: makeId('ms'), kind: 'proposed', text: 'A baby was proposed. 💞', at: nowIso }],
    endedAt: null,
    ending: null,
    clockOffsetMs: 0,
  };
}
