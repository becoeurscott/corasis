import product from '../../shared/product.json';

export type GameStatus = 'available' | 'coming_soon';

export interface Game {
  id: string;
  title: string;
  tagline: string;
  description: string;
  tags: string[];
  players: string;
  pace: string;
  emoji: string;
  /** Identity gradient for the game card, [light end, deep end]. Same in every theme. */
  colors: [string, string];
  status: GameStatus;
}

export const games = product.games as Game[];

/** Unique tags in catalog order, used for the Explore filter chips. */
export const gameTags = [...new Set(games.flatMap((g) => g.tags))];

export const gameById = (id: string) => games.find((g) => g.id === id);
