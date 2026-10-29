import type { QueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { UserSettings } from './types';

/** The language the phone is set to, as a two-letter code; `en` when it cannot tell. */
export function deviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const primary = locale.split(/[-_]/)[0]?.toLowerCase();

    return primary && /^[a-z]{2,3}$/.test(primary) ? primary : 'en';
  } catch {
    return 'en';
  }
}

/** The phone's IANA time zone, as the server wants it saved; null when the phone cannot tell. */
export function deviceTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return typeof zone === 'string' && zone.includes('/') ? zone : null;
  } catch {
    return null;
  }
}

/**
 * The language commits are translated into: the one chosen in settings, else the phone's. The settings are read
 * from the cache when they are there, so translating from a feed costs one request, not two.
 */
export async function translationLanguage(queryClient: QueryClient): Promise<string> {
  const cached = queryClient.getQueryData<UserSettings>(['settings']);
  const settings = cached ?? (await queryClient.fetchQuery({ queryKey: ['settings'], queryFn: () => api.settings(), staleTime: 5 * 60_000 }).catch(() => null));

  return settings?.translation_language ?? deviceLanguage();
}
