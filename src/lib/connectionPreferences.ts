import product from '../../shared/product.json';

export interface ConnectionPreferences { version: number; answers: Record<string, string>; completed: boolean; updatedAt: string }
export const connectionFlow = product.connectionOnboarding;
export type ConnectionQuestion = typeof connectionFlow.questions[number];
export function validateConnectionAnswers(answers: Record<string, string>): Record<string, string> {
  for (const [id, value] of Object.entries(answers)) {
    const question = connectionFlow.questions.find(q => q.id === id);
    if (!question || !question.options.some(o => o.id === value)) throw new Error('Choose one of the available answers.');
  }
  return { ...answers };
}
export function connectionRecommendation(preferences?: ConnectionPreferences | null) {
  if (!preferences || !Object.keys(preferences.answers).length) return null;
  const answers = preferences.answers;
  const source = ['pace', 'focus', 'affection', 'challenge'].map(id => {
    const question = connectionFlow.questions.find(q => q.id === id)!;
    return question.options.find(o => o.id === answers[id]);
  }).find(option => option && 'deckId' in option);
  const deckId = source && 'deckId' in source ? source.deckId : 'deck_ev';
  const deck = product.decks.find(d => d.id === deckId)!;
  const minutes = answers.daily_time === 'two_minutes' ? '2' : answers.daily_time === 'ten_minutes' ? '10' : '5';
  return { deck, title: 'A starting point for you', body: source?.response ?? 'Start with one small moment, at your own pace.', duration: answers.daily_time === 'flexible' || !answers.daily_time ? 'At your own pace' : `About ${minutes} minutes · one prompt is enough` };
}
