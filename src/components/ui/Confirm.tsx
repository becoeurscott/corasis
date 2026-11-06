import React from 'react';
import { create } from 'zustand';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Txt } from './Text';

interface ConfirmOptions {
  title: string;
  body: string;
  confirmTitle?: string;
  cancelTitle?: string;
  destructive?: boolean;
}
interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  answer: (v: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  ask: (options) => new Promise<boolean>((resolve) => set({ options, resolve })),
  answer: (v) => {
    get().resolve?.(v);
    set({ options: null, resolve: null });
  },
}));

export const confirm = (o: ConfirmOptions) => useConfirm.getState().ask(o);

/** Cross-platform confirmation sheet for destructive and irreversible actions. */
export function Confirm() {
  const { options, answer } = useConfirm();
  return (
    <Sheet visible={!!options} onClose={() => answer(false)} title={options?.title}>
      <Txt tone="secondary">{options?.body}</Txt>
      <Button title={options?.confirmTitle ?? 'Confirm'} variant={options?.destructive ? 'danger' : 'primary'} onPress={() => answer(true)} />
      <Button title={options?.cancelTitle ?? 'Cancel'} variant="ghost" onPress={() => answer(false)} />
    </Sheet>
  );
}
