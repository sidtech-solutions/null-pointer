import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { linkTarget } from './urls';

// Only http(s) URLs are opened, so a commit body or profile cannot launch another app's URL scheme.
const WebUrl = /^https?:\/\/\S+$/i;

export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && WebUrl.test(url);
}

export function websiteUrl(website: string): string {
  const trimmed = website.trim();

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Opens a link: a dev-null.sh commit or profile inside the app, anything else in the browser sheet. */
export async function openLink(url: string | null | undefined): Promise<void> {
  if (!isWebUrl(url)) {
    return;
  }

  const target = linkTarget(url);

  if (target.kind === 'commit') {
    router.push({ pathname: '/commits/[id]', params: { id: target.id } });

    return;
  }

  if (target.kind === 'profile') {
    router.push({ pathname: '/users/[username]', params: { username: target.username } });

    return;
  }

  await openInBrowser(url);
}

/** Opens a link in the browser sheet, whatever it points at. */
export async function openInBrowser(url: string | null | undefined): Promise<void> {
  if (!isWebUrl(url)) {
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    // Nothing useful to show if the browser fails to open.
  }
}
