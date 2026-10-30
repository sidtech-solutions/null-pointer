import { useSyncExternalStore } from 'react';

/**
 * The text being written, kept outside React so a keystroke re-renders only
 * the input and the small strips that read it, never the screen around them.
 *
 * Two kinds of change: `typed` and `moved` come from the input itself and
 * only need recording; `write` comes from code (a picked mention, a fenced
 * paste, the restored stash) and the input must follow it, so `version`
 * ticks and the input applies the text and places the caret once.
 */
export type Draft = {
  get(): string;
  caret(): number;
  version(): number;
  typed(text: string): void;
  moved(caret: number): void;
  write(text: string, caret?: number): void;
  subscribe(listener: () => void): () => void;
};

export function createDraft(initial = ''): Draft {
  let text = initial;
  let caret = initial.length;
  let version = 0;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());

  return {
    get: () => text,
    caret: () => caret,
    version: () => version,
    typed(next) {
      if (next !== text) {
        text = next;
        emit();
      }
    },
    moved(next) {
      if (next !== caret) {
        caret = next;
        emit();
      }
    },
    write(next, at = next.length) {
      text = next;
      caret = at;
      version += 1;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Re-renders only when the text changes. */
export function useDraftText(draft: Draft): string {
  return useSyncExternalStore(draft.subscribe, draft.get, draft.get);
}

/** Re-renders only when the caret moves. */
export function useDraftCaret(draft: Draft): number {
  return useSyncExternalStore(draft.subscribe, draft.caret, draft.caret);
}

/** Re-renders only when code wrote the text; the input uses it to place the caret. */
export function useDraftVersion(draft: Draft): number {
  return useSyncExternalStore(draft.subscribe, draft.version, draft.version);
}
