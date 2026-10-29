import { insertIssue, issueReferenceBeforeCaret } from '../issue-reference';

describe('issueReferenceBeforeCaret', () => {
  it('suggests only the number right before the caret', () => {
    expect(issueReferenceBeforeCaret('See #72', 7)).toEqual({ start: 4, end: 7, query: '72' });
    expect(issueReferenceBeforeCaret('See (#722).', 9)).toEqual({ start: 5, end: 9, query: '722' });
  });

  it('stops after a delimiter or more prose', () => {
    for (const ending of [' ', '.', ',', '!', ')', '\n', ' for details']) {
      const text = `See #722${ending}`;

      expect(issueReferenceBeforeCaret(text, text.length)).toBeNull();
    }
  });

  it('ignores code, other repositories, fragments and partial numbers', () => {
    for (const text of ['`#123', '`#123`', '```\n#123', '#123abc', 'owner/repo#123', 'https://example.com/#123', '##123', '#0123', '#0', '#12345678901']) {
      expect(issueReferenceBeforeCaret(text, text.length)).toBeNull();
    }
  });

  it('suggests again once a code block closed', () => {
    const text = '```\ncode\n```\nFixes #9';

    expect(issueReferenceBeforeCaret(text, text.length)).toEqual({ start: text.length - 2, end: text.length, query: '9' });
  });

  it('does not suggest while the caret sits inside the number', () => {
    expect(issueReferenceBeforeCaret('#12 and #345', 3)).toEqual({ start: 0, end: 3, query: '12' });
    expect(issueReferenceBeforeCaret('#12 and #345', 2)).toBeNull();
  });
});

describe('insertIssue', () => {
  it('completes the reference and leaves a space after it', () => {
    expect(insertIssue('Fixes #7 soon', { start: 6, end: 8, query: '7' }, 72)).toEqual({ text: 'Fixes #72  soon', caret: 10 });
  });
});
