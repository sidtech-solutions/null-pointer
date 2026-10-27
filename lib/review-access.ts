import { fromBase64 } from './bytes';
import { adoptKey } from './device-key';
import { SeedBytes, type SshKey } from './ssh-key';

// App Review cannot get past GitHub's device verification (a code emailed to
// the demo account), so review builds carry the seed of a device key that is
// already approved on dev-null.sh for the demo account. Both values are inlined
// at bundle time; a build without them has no reviewer path at all.
//
// The seed grants the demo account to whoever extracts it from the binary, so
// the account holds nothing, and the device is revoked on dev-null.sh once the
// review is done.
const seed = process.env.EXPO_PUBLIC_REVIEW_SEED?.trim() ?? '';
const passphrase = process.env.EXPO_PUBLIC_REVIEW_PASSPHRASE?.trim() ?? '';

export function reviewAccessEnabled(): boolean {
  return seed !== '' && passphrase !== '';
}

export type UnlockOutcome = { type: 'unlocked'; key: SshKey } | { type: 'wrong-passphrase' } | { type: 'error'; message: string };

/** Replaces this phone's device key with the review key when the passphrase matches. */
export async function unlockReviewAccess(entered: string): Promise<UnlockOutcome> {
  if (!reviewAccessEnabled()) {
    return { type: 'error', message: 'fatal: this build has no reviewer access.' };
  }

  if (entered.trim() !== passphrase) {
    return { type: 'wrong-passphrase' };
  }

  let bytes: Uint8Array;

  try {
    bytes = fromBase64(seed);
  } catch {
    return { type: 'error', message: 'fatal: the review seed in this build is not base64.' };
  }

  if (bytes.length !== SeedBytes) {
    return { type: 'error', message: `fatal: the review seed in this build is ${bytes.length} bytes, not ${SeedBytes}.` };
  }

  try {
    return { type: 'unlocked', key: await adoptKey(bytes) };
  } catch (exception) {
    return { type: 'error', message: exception instanceof Error ? exception.message : String(exception) };
  }
}
