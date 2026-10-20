import { useSyncExternalStore } from 'react';

import type { Commit } from './types';

let reporting: Commit | null = null;
const listeners = new Set<() => void>();

export function reportCommit(commit: Commit | null): void {
  reporting = commit;
  listeners.forEach((listener) => listener());
}

export function useReporting(): Commit | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => reporting,
    () => reporting,
  );
}
