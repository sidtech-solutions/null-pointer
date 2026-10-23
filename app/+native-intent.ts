import { getShareExtensionKey } from 'expo-share-intent';

/**
 * The share sheet hands the app a `devnull://` link carrying what was shared;
 * it lands on the composer, which reads the share through expo-share-intent.
 * Every other link goes where it says. This runs outside React, so it must
 * never throw.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return path.includes(getShareExtensionKey()) ? '/compose' : path;
  } catch {
    return '/';
  }
}
