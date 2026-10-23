import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { summaryKey } from './remotes';
import type { ConversationSummary, CurrentUser, InboxPage } from './types';

type Inbox = InfiniteData<InboxPage>;

const inboxQueries = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'remotes' };

/** Changes every cached inbox row for a conversation, whichever tab or search it sits in. */
export function patchInbox(queryClient: QueryClient, key: string, change: (row: ConversationSummary) => ConversationSummary): void {
  queryClient.setQueriesData<Inbox>(inboxQueries, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((row) => (summaryKey(row) === key ? change(row) : row)) })) } : data,
  );
}

export function removeFromInbox(queryClient: QueryClient, key: string): void {
  queryClient.setQueriesData<Inbox>(inboxQueries, (data) => (data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((row) => summaryKey(row) !== key) })) } : data));
}

/** The badge on the Remotes tab, kept in the `me` cache between fetches. */
export function setRemotesUnread(queryClient: QueryClient, count: number): void {
  queryClient.setQueryData<CurrentUser>(['me'], (me) => (me?.remotes && me.remotes.unread_count !== count ? { ...me, remotes: { ...me.remotes, unread_count: count } } : me));
}

export function bumpRemotesUnread(queryClient: QueryClient, delta: number): void {
  queryClient.setQueryData<CurrentUser>(['me'], (me) => (me?.remotes && delta !== 0 ? { ...me, remotes: { ...me.remotes, unread_count: Math.max(0, me.remotes.unread_count + delta) } } : me));
}
