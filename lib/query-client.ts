import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { AppState, type AppStateStatus } from 'react-native';

import { storage } from './storage';

export const SevenDays = 7 * 24 * 60 * 60 * 1000;

const MaxPersistedQueries = 100;

/**
 * Cached responses are kept for seven days and shown immediately while a
 * refresh runs behind them. Mounting never triggers a refetch, so switching
 * tabs is free; refreshes are explicit (pull, focus, poll).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SevenDays,
      staleTime: 1_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
  },
});

// Persist first pages only (no cursor pages, no polls) to keep the write small.
function trim(client: PersistedClient): PersistedClient {
  const queries = client.clientState.queries
    .filter((query) => query.queryKey[0] !== 'log-poll')
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, MaxPersistedQueries)
    .map((query) => {
      const data = query.state.data as { pages?: unknown[]; pageParams?: unknown[] } | undefined;

      if (data && Array.isArray(data.pages) && Array.isArray(data.pageParams) && data.pages.length > 1) {
        return { ...query, state: { ...query.state, data: { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } } };
      }

      return query;
    });

  return { ...client, clientState: { ...client.clientState, queries } };
}

export const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.remove(key);
    },
  },
  key: 'devnull.responses',
  throttleTime: 2_000,
  serialize: (client) => JSON.stringify(trim(client)),
});

// TanStack's focus signal defaults to the browser; map it to AppState so polls stop in the background.
export function wireAppState(): () => void {
  const onChange = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
  const subscription = AppState.addEventListener('change', onChange);

  onlineManager.setOnline(true);

  return () => subscription.remove();
}
