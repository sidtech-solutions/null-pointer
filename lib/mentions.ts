import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useAccount } from './account';
import { api, ApiError } from './client';
import { insertIssue, issueReferenceBeforeCaret, type IssueToken } from './issue-reference';
import { insertMention, mentionBeforeCaret, type MentionToken } from './mention-token';
import type { IssueSuggestion, User } from './types';

export { insertIssue, insertMention, issueReferenceBeforeCaret, type IssueToken, mentionBeforeCaret, type MentionToken };

function matches(user: User, term: string): boolean {
  const needle = term.toLowerCase();

  return needle === '' || user.handle.toLowerCase().includes(needle) || (user.name ?? '').toLowerCase().includes(needle);
}

function rank(users: User[], term: string, limit = 6): User[] {
  const needle = term.toLowerCase();
  const tier = (user: User) => (user.handle.toLowerCase() === needle ? 0 : user.handle.toLowerCase().startsWith(needle) ? 1 : (user.name ?? '').toLowerCase().startsWith(needle) ? 2 : 3);
  const seen = new Set<string>();

  return users
    .filter((user) => {
      const key = user.handle.toLowerCase();

      if (seen.has(key) || !matches(user, term)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .sort((left, right) => tier(left) - tier(right) || left.handle.localeCompare(right.handle))
    .slice(0, limit);
}

export type MentionContext = {
  /** Replying to this commit: its people come first. */
  reply?: string | null;
  /** Quoting this commit: its author comes first. */
  quote?: string | null;
  /** Inside an org: only its members, never the server. */
  members?: User[] | null;
};

/**
 * Who to suggest for the handle being typed. devnull's mention search is the
 * source; a server without it falls back to people search, then to the people
 * the user follows, so a bare "@" always has something to show.
 */
export function useMentionSuggestions(token: MentionToken | null, context: MentionContext = {}): User[] {
  const account = useAccount();
  const me = account.user;
  const [term, setTerm] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) {
      setTerm(null);

      return;
    }

    const timer = setTimeout(() => setTerm(token.term), token.term === '' ? 0 : 150);

    return () => clearTimeout(timer);
  }, [token?.term, token === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const following = useQuery({
    queryKey: ['mention-following', me?.handle],
    queryFn: async () => (await api.connections(me!.handle, 'following')).data.map((connection) => connection.user),
    enabled: account.status === 'signed-in' && me !== null && term !== null && !context.members,
    staleTime: 5 * 60_000,
  });

  const searched = useQuery({
    queryKey: ['mentions', term, context.reply ?? null, context.quote ?? null],
    queryFn: async () => {
      try {
        return await api.mentionSuggestions(term ?? '', { reply: context.reply, quote: context.quote });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }
      }

      if (term === '') {
        return null;
      }

      try {
        return (await api.remoteCandidates(term ?? '')).map((candidate) => candidate.user);
      } catch {
        return null;
      }
    },
    enabled: account.status === 'signed-in' && term !== null && !context.members,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  if (token === null || term === null) {
    return [];
  }

  if (context.members) {
    return rank(context.members.filter((user) => String(user.id) !== String(me?.id)), token.term);
  }

  const pool = searched.data ?? following.data ?? [];

  return rank(pool.filter((user) => String(user.id) !== String(me?.id)), token.term);
}

/** The /dev/null issue with the number being typed, once the typing pauses; null while there is none to show. */
export function useIssueSuggestion(token: IssueToken | null): IssueSuggestion | null {
  const account = useAccount();
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) {
      setNumber(null);

      return;
    }

    const timer = setTimeout(() => setNumber(token.query), 250);

    return () => clearTimeout(timer);
  }, [token?.query, token === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const issue = useQuery({
    queryKey: ['issue', number],
    queryFn: () => api.issueSuggestion(number ?? ''),
    enabled: account.status === 'signed-in' && number !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return token !== null && number === token.query ? (issue.data ?? null) : null;
}
