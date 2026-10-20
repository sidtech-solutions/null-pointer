import * as SecureStore from 'expo-secure-store';

import { fromBase64, toBase64 } from './bytes';
import { randomBytes } from './random';
import { SeedBytes, SshKey } from './ssh-key';

// Only the 32-byte seed is stored, in the Keychain / Keystore.
const StorageKey = 'devnull.device-key';

let loaded: SshKey | null = null;

export async function existingKey(): Promise<SshKey | null> {
  if (loaded !== null) {
    return loaded;
  }

  const stored = await SecureStore.getItemAsync(StorageKey);

  if (stored === null) {
    return null;
  }

  loaded = SshKey.fromSeed(fromBase64(stored));

  return loaded;
}

/**
 * Creates the key on first use. A Keychain read failure throws instead of
 * generating a new key, which would orphan the one already approved on devnull.
 */
export async function currentKey(): Promise<SshKey> {
  const existing = await existingKey();

  if (existing !== null) {
    return existing;
  }

  const key = SshKey.fromSeed(randomBytes(SeedBytes));

  await SecureStore.setItemAsync(StorageKey, toBase64(key.seedBytes()), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  loaded = key;

  return key;
}

export async function forgetKey(): Promise<void> {
  loaded = null;
  await SecureStore.deleteItemAsync(StorageKey);
}
