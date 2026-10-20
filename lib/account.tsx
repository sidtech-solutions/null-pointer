import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { User } from './types';

// Signing out forgets the account only; the device key stays in the Keychain.
const StorageKey = 'devnull.account';

type Status = 'loading' | 'signed-out' | 'signed-in';

type Account = {
  status: Status;
  user: User | null;
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(StorageKey)
      .then((stored) => {
        if (cancelled) {
          return;
        }

        const parsed = stored ? (JSON.parse(stored) as User) : null;
        setUser(parsed);
        setStatus(parsed ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('signed-out');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (next: User) => {
    await AsyncStorage.setItem(StorageKey, JSON.stringify(next));
    setUser(next);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(StorageKey);
    queryClient.clear();
    setUser(null);
    setStatus('signed-out');
  }, [queryClient]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): Account {
  const account = useContext(AccountContext);

  if (account === null) {
    throw new Error('useAccount needs an AccountProvider above it.');
  }

  return account;
}
