import type { Deck, DeckCategory, Question } from '@/services/backend/types';
import product from '../../shared/product.json';

export const categoryMeta = product.categoryMeta as Record<DeckCategory, { label: string; emoji: string; blurb: string }>;
export const questions = product.questions as Question[];
export const decks = product.decks as Deck[];
export const simulatedAnswers = product.simulatedAnswers as Record<string, string>;

export const questionById = (id: string) => questions.find((x) => x.id === id);
export const deckById = (id: string) => decks.find((x) => x.id === id);

/** Deterministic daily question: rotates through the daily deck by day index. */
export function dailyQuestionFor(dayKey: string): Question {
  const pool = decks[0].questionIds;
  const [y, m, d] = dayKey.split('-').map(Number);
  const idx = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) % pool.length;
  return questionById(pool[idx])!;
}
