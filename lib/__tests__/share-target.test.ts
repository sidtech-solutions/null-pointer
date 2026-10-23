import { sharedText, withShared } from '../share-target';

describe('sharedText', () => {
  it('keeps shared text as it is, including a link it already carries', () => {
    expect(sharedText({ text: 'Look at this https://github.com/a/b/pull/1', webUrl: 'https://github.com/a/b/pull/1', meta: null })).toBe('Look at this https://github.com/a/b/pull/1');
  });

  it('adds the link under text that lacks it, and the title above a bare link', () => {
    expect(sharedText({ text: 'Look', webUrl: 'https://example.com', meta: null })).toBe('Look\nhttps://example.com');
    expect(sharedText({ text: null, webUrl: 'https://example.com', meta: { title: 'Example' } })).toBe('Example\nhttps://example.com');
    expect(sharedText({ text: null, webUrl: 'https://example.com', meta: null })).toBe('https://example.com');
    expect(sharedText({ text: null, webUrl: null, meta: null })).toBe('');
  });
});

describe('withShared', () => {
  it('appends below an existing draft with a blank line, or starts from the shared text', () => {
    expect(withShared('', 'shared')).toBe('shared');
    expect(withShared('draft  \n', 'shared')).toBe('draft\n\nshared');
    expect(withShared('draft', '')).toBe('draft');
  });
});
