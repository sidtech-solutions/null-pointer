import * as Crypto from 'expo-crypto';

import { toHex } from './bytes';

export function randomBytes(count: number): Uint8Array {
  return Crypto.getRandomBytes(count);
}

export function randomHex(count: number): string {
  return toHex(randomBytes(count));
}
