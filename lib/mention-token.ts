// Pure text helpers for @mentions, kept apart from the hook so tests need no native modules.

/** The `@handle` being typed, if the caret sits in one: where it starts and the handle so far. */
export type MentionToken = { start: number; end: number; term: string };

const Handle = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?$/;

export function mentionBeforeCaret(text: string, caret: number): MentionToken | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');

  if (at < 0) {
    return null;
  }

  const previous = at === 0 ? ' ' : before[at - 1];

  if (/[\p{L}\p{N}_.\/-]/u.test(previous)) {
    return null;
  }

  const term = before.slice(at + 1);

  if (term !== '' && !Handle.test(term)) {
    return null;
  }

  const after = text.slice(caret);

  if (/^[A-Za-z0-9-]/.test(after)) {
    return null;
  }

  return { start: at, end: caret, term };
}

/** The text with the token replaced by the handle and a space, and where the caret lands. */
export function insertMention(text: string, token: MentionToken, username: string): { text: string; caret: number } {
  const mention = `@${username} `;

  return { text: text.slice(0, token.start) + mention + text.slice(token.end), caret: token.start + mention.length };
}
