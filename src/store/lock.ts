import { create } from 'zustand';

interface LockState {
  locked: boolean;
  setLocked: (v: boolean) => void;
}

/** In-memory lock state: the app starts locked when app lock is enabled. */
export const useLock = create<LockState>((set) => ({ locked: true, setLocked: (locked) => set({ locked }) }));
