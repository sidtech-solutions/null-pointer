import { useSyncExternalStore } from 'react';

let current: { id: number; text: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function toast(text: string, duration = 2_400): void {
  current = { id: Date.now(), text };
  emit();

  if (timer !== null) {
    clearTimeout(timer);
  }

  timer = setTimeout(() => {
    current = null;
    timer = null;
    emit();
  }, duration);
}

export function useToast(): { id: number; text: string } | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
