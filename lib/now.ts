import { useSyncExternalStore } from 'react';

// One shared 30s tick, so only the relative-time text re-renders, not the rows around it.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (timer === null) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 30_000);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => now);
}
