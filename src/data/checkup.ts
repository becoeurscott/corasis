import product from '../../shared/product.json';

/** Marriage Check-up content, shared with the iOS app (shared/product.json → "checkup"). */
export interface CheckupItem { id: string; emoji: string; text: string }
export interface CheckupBand { min: number; title: string; text: string }

export const checkup = product.checkup as { scale: string[]; items: CheckupItem[]; bands: CheckupBand[]; disclaimer: string };
export const checkupItemCount = checkup.items.length;

/** 25 ratings from 1 to 5 → 0…100 %. Same rule as CheckupEntry.score in Swift. */
export const checkupScore = (ratings: number[]) => Math.max(0, Math.min(100, ratings.reduce((a, b) => a + b, 0) - ratings.length));
export const checkupBand = (score: number) => checkup.bands.find((b) => score >= b.min) ?? checkup.bands[checkup.bands.length - 1];
/** Guess points: 100 for a perfect guess, minus 4 per point off. */
export const guessPoints = (guess: number, actual: number) => Math.max(0, 100 - Math.abs(guess - actual) * 4);
