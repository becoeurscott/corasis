import type { Deck, DeckCategory, Question } from '@/services/backend/types';

export const categoryMeta: Record<DeckCategory, { label: string; emoji: string; blurb: string }> = {
  getting_to_know: { label: 'Getting to know each other', emoji: '🌱', blurb: 'Light questions for the early days (or a fresh look).' },
  everyday: { label: 'Everyday connection', emoji: '☕', blurb: 'Small check-ins that keep daily life shared.' },
  deeper: { label: 'Deeper conversations', emoji: '🌙', blurb: 'Slower questions for when you have time.' },
  love: { label: 'Love and appreciation', emoji: '💗', blurb: 'Say the things you think but rarely say.' },
  long_distance: { label: 'Long distance', emoji: '✈️', blurb: 'For couples living in two places.' },
  future: { label: 'Future plans', emoji: '🧭', blurb: 'Dreams, logistics and what comes next.' },
  repair: { label: 'Communication and repair', emoji: '🪢', blurb: 'Gentle prompts for after a hard moment. Not therapy.' },
  fun: { label: 'Fun and playful', emoji: '🎈', blurb: 'Silly, quick and low stakes.' },
};

const q = (id: string, category: DeckCategory, text: string, extra: Partial<Question> = {}): Question => ({
  id,
  type: 'daily_question',
  category,
  text,
  ...extra,
});

export const questions: Question[] = [
  // Getting to know each other
  q('gk1', 'getting_to_know', 'What is a small thing that instantly puts you in a good mood?'),
  q('gk2', 'getting_to_know', 'Which childhood habit do you still secretly have?'),
  q('gk3', 'getting_to_know', 'What is a song you could listen to on repeat right now?'),
  q('gk4', 'getting_to_know', 'If you had a free Saturday with no plans, how would it go?'),
  q('gk5', 'getting_to_know', 'What is something you are weirdly good at?'),
  q('gk6', 'getting_to_know', 'What was your favorite meal growing up?'),
  q('gk7', 'getting_to_know', 'Which place makes you feel most like yourself?'),
  q('gk8', 'getting_to_know', 'What is a skill you would love to learn this year?'),
  // Everyday connection
  q('ev1', 'everyday', 'What was the best part of your day so far?'),
  q('ev2', 'everyday', 'What is one thing on your mind that you have not said out loud yet?'),
  q('ev3', 'everyday', 'What did you eat today that you would recommend?'),
  q('ev4', 'everyday', 'Who made you smile today?'),
  q('ev5', 'everyday', 'What is something small I could do to make tomorrow easier for you?'),
  q('ev6', 'everyday', 'What are you looking forward to this week?'),
  q('ev7', 'everyday', 'What did you see today that reminded you of me?'),
  q('ev8', 'everyday', 'How is your energy right now, from 1 to 10, and why?'),
  // Deeper conversations
  q('dp1', 'deeper', 'What is something you are proud of that you rarely mention?'),
  q('dp2', 'deeper', 'When do you feel most understood by me?'),
  q('dp3', 'deeper', 'What is a belief you have changed your mind about?'),
  q('dp4', 'deeper', 'What does rest actually look like for you?'),
  q('dp5', 'deeper', 'What is a fear you have about us that you would like to say gently?'),
  q('dp6', 'deeper', 'What is one thing your younger self would be surprised about in your life now?'),
  q('dp7', 'deeper', 'Which friendship has shaped you the most?'),
  q('dp8', 'deeper', 'What helps you when you feel overwhelmed?'),
  // Love and appreciation
  q('lv1', 'love', 'What is something I did recently that you appreciated more than I probably realized?'),
  q('lv2', 'love', 'How do you most like to receive affection: words, time, touch, help, or gifts?'),
  q('lv3', 'love', 'What is your favorite memory of us from this year?'),
  q('lv4', 'love', 'What is a quality of mine you hope never changes?'),
  q('lv5', 'love', 'When did you first feel at home with me?'),
  q('lv6', 'love', 'What is a compliment you wish you heard more often?'),
  q('lv7', 'love', 'What makes you feel chosen?'),
  q('lv8', 'love', 'What is one small ritual of ours that you love?'),
  // Long distance
  q('ld1', 'long_distance', 'What is the hardest hour of the day to be apart?'),
  q('ld2', 'long_distance', 'What is something you want to do together in the first hour we see each other next?'),
  q('ld3', 'long_distance', 'How do you like to be supported after a long day when we cannot be in the same room?'),
  q('ld4', 'long_distance', 'What small object of mine do you wish you had with you?'),
  q('ld5', 'long_distance', 'What is a time-zone trick that would make calls easier for you?'),
  q('ld6', 'long_distance', 'What is one thing that is actually easier about distance right now?'),
  q('ld7', 'long_distance', 'What do you want our next visit to feel like?'),
  q('ld8', 'long_distance', 'Which message of mine do you reread when you miss me?'),
  // Future plans
  q('ft1', 'future', 'If we could live anywhere for one year, where would you pick?'),
  q('ft2', 'future', 'What is one trip you want us to take before anything else?'),
  q('ft3', 'future', 'What does a good Sunday look like for us in five years?'),
  q('ft4', 'future', 'What is a tradition you would like us to start?'),
  q('ft5', 'future', 'What are you saving up for, big or small?'),
  q('ft6', 'future', 'What would you want our home to feel like when someone walks in?'),
  q('ft7', 'future', 'What is a goal you would like us to work on together this year?'),
  q('ft8', 'future', 'What is something you want to be true about us next anniversary?'),
  // Communication and repair
  q('rp1', 'repair', 'When we disagree, what helps you feel heard?'),
  q('rp2', 'repair', 'What is a sign that you need a break during a tough conversation?'),
  q('rp3', 'repair', 'What is something you wish I understood about how you argue?'),
  q('rp4', 'repair', 'How do you like to be approached after a misunderstanding?'),
  q('rp5', 'repair', 'What is one thing I could say that would make repair easier for you?'),
  q('rp6', 'repair', 'What is a small misunderstanding we can laugh about now?'),
  q('rp7', 'repair', 'What does a good apology sound like to you?'),
  q('rp8', 'repair', 'What is something you would like to ask for more often without feeling needy?'),
  // Fun and playful
  q('fn1', 'fun', 'If we were a duo in a movie, what genre would it be?'),
  q('fn2', 'fun', 'What is your most unreasonable food opinion?'),
  q('fn3', 'fun', 'Which fictional couple are we most like?'),
  q('fn4', 'fun', 'What would your walk-on music be?'),
  q('fn5', 'fun', 'What is a tiny luxury you refuse to give up?'),
  q('fn6', 'fun', 'If you had to teach a class on anything, what would it be?'),
  q('fn7', 'fun', 'What is the best bad movie you have ever loved?'),
  q('fn8', 'fun', 'What animal would you be in a team of two?'),

  // Quiz: who knows the other best? (answers about your partner; partner answers about themselves)
  q('qz1', 'fun', "What is your partner's go-to comfort food?", { type: 'quiz', aboutPartner: true }),
  q('qz2', 'fun', 'How does your partner take their coffee or tea?', { type: 'quiz', aboutPartner: true, options: ['Black / plain', 'With milk', 'With sugar', 'Milk and sugar', 'Neither, something else'] }),
  q('qz3', 'fun', 'Which would your partner pick for a free evening?', { type: 'quiz', aboutPartner: true, options: ['A long walk', 'A movie at home', 'Dinner out', 'Early night'] }),
  q('qz4', 'fun', "What is your partner's biggest small annoyance?", { type: 'quiz', aboutPartner: true }),
  q('qz5', 'fun', 'What is your partner most likely to do on a rainy Sunday?', { type: 'quiz', aboutPartner: true, options: ['Cook something', 'Read or scroll', 'Nap', 'Call someone'] }),
  q('qz6', 'fun', 'Which season is your partner happiest in?', { type: 'quiz', aboutPartner: true, options: ['Spring', 'Summer', 'Autumn', 'Winter'] }),

  // Would you rather (couples edition)
  q('wr1', 'fun', 'Would you rather', { type: 'would_you_rather', options: ['Cook together every night', 'Eat out together every night'] }),
  q('wr2', 'fun', 'Would you rather', { type: 'would_you_rather', options: ['A surprise weekend trip', 'A planned two-week holiday'] }),
  q('wr3', 'fun', 'Would you rather', { type: 'would_you_rather', options: ['Morning calls', 'Late-night calls'] }),
  q('wr4', 'fun', 'Would you rather', { type: 'would_you_rather', options: ['Handwritten letters', 'Voice notes'] }),
  q('wr5', 'fun', 'Would you rather', { type: 'would_you_rather', options: ['Live near the sea', 'Live near the mountains'] }),
  q('wr6', 'fun', 'Would you rather', { type: 'would_you_rather', options: ['Relive our first date', 'Fast-forward to our next trip'] }),

  // Guess your partner's answer
  q('gs1', 'love', "What would your partner say is their favorite thing about you?", { type: 'guess', aboutPartner: true }),
  q('gs2', 'future', 'Where would your partner want to travel next?', { type: 'guess', aboutPartner: true }),
  q('gs3', 'everyday', 'What did your partner have for breakfast today?', { type: 'guess', aboutPartner: true }),
  q('gs4', 'fun', 'What song is your partner playing on repeat this week?', { type: 'guess', aboutPartner: true }),

  // Photo challenges
  q('pc1', 'everyday', 'Show me your view right now.', { type: 'photo_challenge' }),
  q('pc2', 'everyday', 'Something that made you smile today.', { type: 'photo_challenge' }),
  q('pc3', 'fun', 'Your most chaotic corner.', { type: 'photo_challenge' }),
  q('pc4', 'love', 'Something that reminds you of me.', { type: 'photo_challenge' }),
  q('pc5', 'long_distance', 'The sky where you are.', { type: 'photo_challenge' }),
  q('pc6', 'fun', 'Your outfit of the day, with commentary.', { type: 'photo_challenge' }),
];

const byCat = (c: DeckCategory, type: Question['type'] = 'daily_question') =>
  questions.filter((x) => x.category === c && x.type === type).map((x) => x.id);

export const decks: Deck[] = [
  { id: 'deck_daily', title: 'Daily question', category: 'everyday', type: 'daily_question', description: 'One question a day, answered separately and revealed together.', questionIds: questions.filter((x) => x.type === 'daily_question').map((x) => x.id), premium: false, emoji: '💬' },
  { id: 'deck_quiz', title: 'Who knows the other best?', category: 'fun', type: 'quiz', description: 'Guess facts about each other. Scores are for fun, not a verdict.', questionIds: questions.filter((x) => x.type === 'quiz').map((x) => x.id), premium: false, emoji: '🧠' },
  { id: 'deck_wyr', title: 'Would you rather? Couples edition', category: 'fun', type: 'would_you_rather', description: 'Pick a side, then see if you agree.', questionIds: questions.filter((x) => x.type === 'would_you_rather').map((x) => x.id), premium: false, emoji: '⚖️' },
  { id: 'deck_guess', title: "Guess your partner's answer", category: 'love', type: 'guess', description: 'Predict what they will say. Reveal side by side.', questionIds: questions.filter((x) => x.type === 'guess').map((x) => x.id), premium: false, emoji: '🔮' },
  { id: 'deck_photo', title: 'Daily photo challenge', category: 'everyday', type: 'photo_challenge', description: 'A small photo prompt for both of you.', questionIds: questions.filter((x) => x.type === 'photo_challenge').map((x) => x.id), premium: false, emoji: '📸' },
  { id: 'deck_gk', title: 'Getting to know each other', category: 'getting_to_know', type: 'deck', description: categoryMeta.getting_to_know.blurb, questionIds: byCat('getting_to_know'), premium: false, emoji: '🌱' },
  { id: 'deck_ev', title: 'Everyday connection', category: 'everyday', type: 'deck', description: categoryMeta.everyday.blurb, questionIds: byCat('everyday'), premium: false, emoji: '☕' },
  { id: 'deck_dp', title: 'Deeper conversations', category: 'deeper', type: 'deck', description: categoryMeta.deeper.blurb, questionIds: byCat('deeper'), premium: false, emoji: '🌙' },
  { id: 'deck_lv', title: 'Love and appreciation', category: 'love', type: 'deck', description: categoryMeta.love.blurb, questionIds: byCat('love'), premium: false, emoji: '💗' },
  { id: 'deck_ld', title: 'Long distance', category: 'long_distance', type: 'deck', description: categoryMeta.long_distance.blurb, questionIds: byCat('long_distance'), premium: false, emoji: '✈️' },
  { id: 'deck_ft', title: 'Future plans', category: 'future', type: 'deck', description: categoryMeta.future.blurb, questionIds: byCat('future'), premium: true, emoji: '🧭' },
  { id: 'deck_rp', title: 'Communication and repair', category: 'repair', type: 'deck', description: categoryMeta.repair.blurb, questionIds: byCat('repair'), premium: true, emoji: '🪢' },
  { id: 'deck_fn', title: 'Fun and playful', category: 'fun', type: 'deck', description: categoryMeta.fun.blurb, questionIds: byCat('fun'), premium: false, emoji: '🎈' },
];

export const questionById = (id: string) => questions.find((x) => x.id === id);
export const deckById = (id: string) => decks.find((x) => x.id === id);

/** Deterministic daily question: rotates through the daily deck by day index. */
export function dailyQuestionFor(dayKey: string): Question {
  const pool = decks[0].questionIds;
  const [y, m, d] = dayKey.split('-').map(Number);
  const idx = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) % pool.length;
  return questionById(pool[idx])!;
}

/** Simulated partner replies for demo mode. Never presented as a real person. */
export const simulatedAnswers: Record<string, string> = {
  default: 'Honestly? Thinking about our next trip. I keep planning it in my head.',
  gk1: 'Sun on the kitchen table in the morning.',
  ev1: 'A long walk after work, finally no rain.',
  ev4: 'A kid on the bus wearing a dinosaur backpack.',
  lv1: 'When you called just to say good night even though you were exhausted.',
  ld2: 'Just hold hands and get coffee. Nothing fancy.',
  ft1: 'Lisbon. Hills, light, pastries.',
  rp1: 'When you repeat back what I said before replying.',
  fn3: 'The one from that cooking show, obviously.',
  qz2: 'With milk',
  qz3: 'A long walk',
  qz5: 'Cook something',
  qz6: 'Autumn',
  wr1: 'Cook together every night',
  wr2: 'A surprise weekend trip',
  wr3: 'Late-night calls',
  wr4: 'Voice notes',
  wr5: 'Live near the sea',
  wr6: 'Fast-forward to our next trip',
  gs1: 'That you notice small things.',
  gs2: 'Japan in spring.',
  gs3: 'Toast with too much butter.',
  gs4: 'That old Sade album again.',
};
