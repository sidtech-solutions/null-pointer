import { hrefFor, linkLabel, linkTarget, shortenUrl, UrlPattern, withoutTrailingPunctuation } from '../urls';

describe('linkTarget', () => {
  it('reads a dev/null commit link', () => {
    expect(linkTarget('https://dev-null.sh/@nunomaduro/commits/0199f3a2-1b2c-7d3e-8f4a-5b6c7d8e9f0a')).toEqual({ kind: 'commit', username: 'nunomaduro', id: '0199f3a2-1b2c-7d3e-8f4a-5b6c7d8e9f0a' });
  });

  it('reads a dev/null profile link', () => {
    expect(linkTarget('https://www.dev-null.sh/@taylorotwell/')).toEqual({ kind: 'profile', username: 'taylorotwell' });
  });

  it('reads GitHub repositories, issues and pull requests', () => {
    expect(linkTarget('https://github.com/laravel/framework')).toEqual({ kind: 'github', owner: 'laravel', repository: 'framework', number: null });
    expect(linkTarget('https://github.com/nunomaduro/dev-null.sh/pull/829')).toEqual({ kind: 'github', owner: 'nunomaduro', repository: 'dev-null.sh', number: '829' });
    expect(linkTarget('https://github.com/nunomaduro/dev-null.sh/issues/478')).toEqual({ kind: 'github', owner: 'nunomaduro', repository: 'dev-null.sh', number: '478' });
  });

  it('leaves GitHub pages that are not repositories, and everything else, as web links', () => {
    expect(linkTarget('https://github.com/features/actions').kind).toBe('web');
    expect(linkTarget('https://github.com/laravel/framework/blob/12.x/README.md').kind).toBe('web');
    expect(linkTarget('https://dev-null.sh/@nunomaduro/commits/not-an-id').kind).toBe('web');
    expect(linkTarget('https://example.com/@nunomaduro').kind).toBe('web');
  });
});

describe('shortenUrl', () => {
  it('drops the scheme and www and keeps a short path whole', () => {
    expect(shortenUrl('https://www.example.com/docs')).toBe('example.com/docs');
  });

  it('cuts a long path to 20 characters with an ellipsis', () => {
    expect(shortenUrl('https://example.com/a/very/long/path/that/keeps/going/on')).toBe('example.com/a/very/long/path/t…');
  });

  it('keeps www when it is the whole host', () => {
    expect(shortenUrl('https://www.com/x')).toBe('www.com/x');
  });
});

describe('linkLabel', () => {
  it('shows commits, repositories and plain links the way the web does', () => {
    expect(linkLabel('https://dev-null.sh/@nunomaduro/commits/0199f3a2-1b2c-7d3e-8f4a-5b6c7d8e9f0a')).toBe('nunomaduro/0199f3a');
    expect(linkLabel('https://github.com/nunomaduro/dev-null.sh/pull/829')).toBe('nunomaduro/dev-null.sh#829');
    expect(linkLabel('https://www.example.com/docs')).toBe('example.com/docs');
  });
});

describe('UrlPattern', () => {
  const links = (text: string) => Array.from(text.matchAll(UrlPattern), (match) => withoutTrailingPunctuation(match[0]));

  it('finds full URLs and bare domains, without closing punctuation', () => {
    expect(links('see https://example.com/docs. and laravel.com, or (github.com/x/y)')).toEqual(['https://example.com/docs', 'laravel.com', 'github.com/x/y']);
  });

  it('does not treat file names or emails as links', () => {
    expect(links('open index.html or mail me@example.com')).toEqual([]);
  });

  it('gives bare domains a scheme to open', () => {
    expect(hrefFor('laravel.com')).toBe('https://laravel.com');
    expect(hrefFor('https://')).toBeNull();
  });
});
