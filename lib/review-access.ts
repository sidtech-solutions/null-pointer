import { fromBase64 } from './bytes';
import { adoptKey } from './device-key';
import { SeedBytes, type SshKey } from './ssh-key';

// App Review cannot get past GitHub's device verification (a code emailed to
// the demo account), and reviewers type the username and password from the
// App Store Connect form into whatever fields the app shows. So review builds
// show a username and password form, and the demo account's handle with the
// passphrase as its password swaps in the seed of a device key that is already
// approved on dev-null.sh for that account. All three values are inlined at
// bundle time; a build without the seed and passphrase has no such form.
//
// The seed grants the demo account to whoever extracts it from the binary, so
// the account holds nothing, and the device is revoked on dev-null.sh once the
// review is done.
const seed = process.env.EXPO_PUBLIC_REVIEW_SEED?.trim() ?? '';
const passphrase = process.env.EXPO_PUBLIC_REVIEW_PASSPHRASE?.trim() ?? '';
const handle = (process.env.EXPO_PUBLIC_REVIEW_HANDLE?.trim() || 'null-pointer-auto').replace(/^@/, '').toLowerCase();

export function reviewAccessEnabled(): boolean {
  return seed !== '' && passphrase !== '';
}

/** The demo account's handle, for the form's placeholder. */
export function reviewHandle(): string {
  return handle;
}

export type UnlockOutcome = { type: 'unlocked'; key: SshKey } | { type: 'wrong-credentials' } | { type: 'error'; message: string };

/** Replaces this phone's device key with the review key when the username is the demo account and the password its passphrase. */
export async function unlockReviewAccess(username: string, password: string): Promise<UnlockOutcome> {
  if (!reviewAccessEnabled()) {
    return { type: 'error', message: 'fatal: this build has no reviewer access.' };
  }

  if (username.trim().replace(/^@/, '').toLowerCase() !== handle || password.trim() !== passphrase) {
    return { type: 'wrong-credentials' };
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
