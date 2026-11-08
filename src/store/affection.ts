import { create } from 'zustand';

/** Emoji bursts currently floating on screen (see components/affection/AffectionRain). */
export const AFFECTION_EMOJIS = ['❤️', '😘', '🥰', '🤗', '🌹', '✨'] as const;

type Burst = { id: string; emoji: string };
export const useAffection = create<{ bursts: Burst[]; show: (emoji: string) => void; done: (id: string) => void }>((set) => ({
  bursts: [],
  show: (emoji) => set((s) => ({ bursts: [...s.bursts, { id: `${Date.now()}-${Math.random()}`, emoji }] })),
  done: (id) => set((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
}));
