import * as WebBrowser from 'expo-web-browser';

// Only http(s) URLs are opened, so a commit body or profile cannot launch another app's URL scheme.
const WebUrl = /^https?:\/\/\S+$/i;

export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && WebUrl.test(url);
}

export function websiteUrl(website: string): string {
  const trimmed = website.trim();

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function openLink(url: string | null | undefined): Promise<void> {
  if (!isWebUrl(url)) {
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    // Nothing useful to show if the browser fails to open.
  }
}
