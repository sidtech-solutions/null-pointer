import type { ShareIntent } from 'expo-share-intent';

/**
 * What another app shared, as the text the composer starts from: the text
 * itself when there is one, else the page's title above its link. A link the
 * text already carries is not repeated.
 */
export function sharedText(intent: Pick<ShareIntent, 'text' | 'webUrl' | 'meta'>): string {
  const text = (intent.text ?? '').trim();
  const url = (intent.webUrl ?? '').trim();
  const title = (intent.meta?.title ?? '').trim();

  if (text !== '' && (url === '' || text.includes(url))) {
    return text;
  }

  if (text !== '') {
    return `${text}\n${url}`;
  }

  if (url !== '') {
    return title !== '' && title !== url ? `${title}\n${url}` : url;
  }

  return '';
}

/** The draft with what was shared added below whatever was already written. */
export function withShared(draft: string, shared: string): string {
  const current = draft.replace(/\s+$/, '');

  return shared === '' ? draft : current === '' ? shared : `${current}\n\n${shared}`;
}
