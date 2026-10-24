import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';

/**
 * Whether the phone can reach the internet, as the system reports it. TanStack
 * pauses queries while offline; the outbox pushes when it comes back.
 */
export function wireNetwork(onOnline: () => void): () => void {
  const apply = (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => {
    const online = state.isInternetReachable ?? state.isConnected ?? true;
    const was = onlineManager.isOnline();

    onlineManager.setOnline(online);

    if (online && !was) {
      onOnline();
    }
  };

  Network.getNetworkStateAsync().then(apply).catch(() => {});

  const subscription = Network.addNetworkStateListener(apply);

  return () => subscription.remove();
}

export function isOnline(): boolean {
  return onlineManager.isOnline();
}

/** True while the phone can reach the internet; re-renders when that changes. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
    () => true,
  );
}
