import { useSyncExternalStore } from 'react';

/** A button on the toast; pressing it dismisses the toast and runs it. */
export type ToastAction = { label: string; run: () => void };

export type Toast = { id: number; text: string; action: ToastAction | null; until: number };

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function toast(text: string, duration = 2_400, action: ToastAction | null = null): void {
  current = { id: Date.now(), text, action, until: Date.now() + duration };
  emit();

  if (timer !== null) {
    clearTimeout(timer);
  }

  timer = setTimeout(dismissToast, duration);
}

export function dismissToast(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  current = null;
  emit();
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
