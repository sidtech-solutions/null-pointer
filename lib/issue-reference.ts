// Pure text helper for `#123` issue references, kept apart from the hook so tests need no native modules.

/** The issue number being typed, if the caret sits right after one: where the `#` is and the digits so far. */
export type IssueToken = { start: number; end: number; query: string };

/** The prose the caret is in, with fenced blocks and inline code before it taken out; null while the caret is inside code. */
function proseBeforeCaret(before: string): string | null {
  const fences = before.split(/^`{3,}.*$/mu);

  // An odd number of fences means the last one opened a block the caret is still in.
  if (fences.length % 2 === 0) {
    return null;
  }

  const prose = fences[fences.length - 1];
  const spans = prose.split('`');

  return spans.length % 2 === 0 ? null : spans[spans.length - 1];
}

export function issueReferenceBeforeCaret(text: string, caret: number): IssueToken | null {
  const prose = proseBeforeCaret(text.slice(0, caret));

  if (prose === null) {
    return null;
  }

  const match = prose.match(/(?:^|[\s([{])#([1-9][0-9]{0,9})$/u);

  if (!match) {
    return null;
  }

  // The reference ends at the caret: more letters or digits after it would make it something else.
  if (/^[\p{L}\p{N}_/#-]/u.test(text.slice(caret))) {
    return null;
  }

  return { start: caret - match[1].length - 1, end: caret, query: match[1] };
}

/** The text with the reference completed and a space after it, and where the caret lands. */
export function insertIssue(text: string, token: IssueToken, number: number): { text: string; caret: number } {
  const reference = `#${number} `;

  return { text: text.slice(0, token.start) + reference + text.slice(token.end), caret: token.start + reference.length };
}
