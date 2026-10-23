import { insertMention, mentionBeforeCaret } from '../mention-token';

describe('mentionBeforeCaret', () => {
  it('finds a bare @ and a partial handle before the caret', () => {
    expect(mentionBeforeCaret('hey @', 5)).toEqual({ start: 4, end: 5, term: '' });
    expect(mentionBeforeCaret('hey @sar', 8)).toEqual({ start: 4, end: 8, term: 'sar' });
  });

  it('ignores an @ glued to a word, an email, or a finished handle', () => {
    expect(mentionBeforeCaret('mail me@example.com', 7)).toBeNull();
    expect(mentionBeforeCaret('hey @sarah more', 9)).toBeNull();
    expect(mentionBeforeCaret('hey @sarah more', 15)).toBeNull();
  });

  it('only looks at the handle the caret is in', () => {
    expect(mentionBeforeCaret('@one and @tw', 12)).toEqual({ start: 9, end: 12, term: 'tw' });
  });
});

describe('insertMention', () => {
  it('replaces the token with the handle and a space, and puts the caret after it', () => {
    expect(insertMention('hey @sar there', { start: 4, end: 8, term: 'sar' }, 'SarahSibert')).toEqual({ text: 'hey @SarahSibert  there', caret: 17 });
  });
});
