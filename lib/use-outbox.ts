import { useSyncExternalStore } from 'react';

import { outbox, type OutboxItem, subscribeOutbox } from './outbox';

let snapshot: OutboxItem[] = outbox();

function current(): OutboxItem[] {
  return snapshot;
}

subscribeOutbox(() => {
  snapshot = outbox();
});

/** The commits waiting to be pushed; re-renders as the outbox changes. */
export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribeOutbox, current, current);
}
