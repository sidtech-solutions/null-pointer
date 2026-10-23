// How a link shows in a commit, kept in step with the web's resources/js/lib/urls.ts and linkified-text.tsx.

const Handle = '[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}';

// A link to a commit on dev/null itself, nothing after its id, so it can show as the author and the commit's hash.
const CommitLink = new RegExp(`^https?:\\/\\/(?:www\\.)?dev-null\\.sh\\/@(${Handle})\\/commits\\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\/?$`, 'i');

// A link to a profile on dev/null, nothing after the handle.
const ProfileLink = new RegExp(`^https?:\\/\\/(?:www\\.)?dev-null\\.sh\\/@(${Handle})\\/?$`, 'i');

// A link to a GitHub repository, or to one of its issues or pull requests, nothing after its name or number.
const GitHubLink = new RegExp(`^https?:\\/\\/(?:www\\.)?github\\.com\\/(${Handle})\\/([A-Za-z0-9._-]{1,100})(?:\\/(issues|pull)\\/([1-9][0-9]{0,9}))?\\/?$`, 'i');

// First path segments that are GitHub's own pages rather than an owner, like "github.com/features/actions".
const GitHubReserved = new Set(
  'about apps codespaces collections customer-stories enterprise events explore features issues login marketplace new notifications orgs organizations pricing pulls search security settings site sponsors topics trending users'.split(' '),
);

// Like X, a URL shows without its scheme or "www.", with the whole host, and with at most 20 characters after it.
const MaxShortenedPath = 20;

export type LinkTarget =
  | { kind: 'commit'; username: string; id: string }
  | { kind: 'profile'; username: string }
  | { kind: 'github'; owner: string; repository: string; number: string | null }
  | { kind: 'web' };

/** What a link in a body points at, so it can show the way the web shows it and open in the app when it can. */
export function linkTarget(url: string): LinkTarget {
  const commit = CommitLink.exec(url);

  if (commit) {
    return { kind: 'commit', username: commit[1], id: commit[2].toLowerCase() };
  }

  const profile = ProfileLink.exec(url);

  if (profile) {
    return { kind: 'profile', username: profile[1] };
  }

  const github = GitHubLink.exec(url);

  if (github && !GitHubReserved.has(github[1].toLowerCase())) {
    return { kind: 'github', owner: github[1], repository: github[2], number: github[4] ?? null };
  }

  return { kind: 'web' };
}

/** The URL without its scheme or "www.", its path cut to 20 characters with an ellipsis, as the web shortens it. */
export function shortenUrl(url: string): string {
  const hidden = /^(?:https?:\/\/)?(?:www\.(?=[^/?#]*\.))?/i.exec(url)?.[0] ?? '';
  const rest = url.slice(hidden.length);
  const host = rest.replace(/[/?#][\s\S]*$/u, '');
  const path = Array.from(rest.slice(host.length));

  if (path.length <= MaxShortenedPath) {
    return rest;
  }

  const kept = path
    .slice(0, MaxShortenedPath - 1)
    .join('')
    .replace(/%[0-9A-Fa-f]?$/, '');

  return `${host}${kept}…`;
}

/** The text a link shows in a body, as the web shows it. */
export function linkLabel(url: string): string {
  const target = linkTarget(url);

  switch (target.kind) {
    case 'commit':
      return `${target.username}/${target.id.slice(0, 7)}`;
    case 'profile':
      return `@${target.username}`;
    case 'github':
      return `${target.owner}/${target.repository}${target.number ? `#${target.number}` : ''}`;
    default:
      return shortenUrl(url);
  }
}

// Keep URL recognition in sync with the web's lib/urls.ts: bare domains deliberately exclude file-like TLDs.
const TopLevelDomains =
  'com org net edu gov mil info biz io dev app co ai me xyz tech gg tv fm ly to is blog cloud site online design studio tools software codes wiki news website club ninja rocks academy guide social digital agency fyi lol live uk de fr nl es it pt br ca au jp ch se no dk fi be at ie nz us eu cz sk hu ro bg gr hr si ee lv lt ru ua tr il za mx ar kr cn tw hk sg vn th'.split(' ');

/** Every URL and bare domain in prose, as the server finds them for links and link cards. */
export const UrlPattern = new RegExp(
  String.raw`(?<![\p{L}\p{N}\p{M}\p{Pc}])[Hh][Tt][Tt][Pp][Ss]?:\/\/[^\s<>]+` +
    String.raw`|(?<![\p{L}\p{N}_.\/@-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+` +
    String.raw`(?:${[...TopLevelDomains, ...TopLevelDomains.map((domain) => domain.toUpperCase())].join('|')})` +
    String.raw`(?![\p{L}\p{N}_(-]|\.[A-Za-z0-9])(?:[\/?#][^\s<>]*)?`,
  'gu',
);

const Brackets = [
  ['(', ')'],
  ['[', ']'],
] as const;

function occurrences(text: string, character: string): number {
  return text.split(character).length - 1;
}

/** The link without the punctuation that closes the sentence around it. */
export function withoutTrailingPunctuation(candidate: string): string {
  let url = candidate;
  let previous: string;

  do {
    previous = url;
    url = url.replace(/[.,;:!?'"…”’]+$/u, '');

    for (const [open, close] of Brackets) {
      if (url.endsWith(close) && occurrences(url, open) < occurrences(url, close)) {
        url = url.slice(0, -1);
      }
    }
  } while (url !== previous);

  return url;
}

/** The address a link in prose opens: a bare domain gets https, and nothing too long or empty opens at all. */
export function hrefFor(linkText: string): string | null {
  const href = /^https?:\/\//i.test(linkText) ? linkText : `https://${linkText}`;

  return href.endsWith('://') || Array.from(href).length > 2048 ? null : href;
}
