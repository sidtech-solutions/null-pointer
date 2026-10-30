import type { FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery, useQueries, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Feed, type FeedItem, feedItems } from '@/components/feed';
import { FollowingEmpty } from '@/components/following-empty';
import { NewCommitsPill } from '@/components/new-commits-pill';
import { OutboxBanner } from '@/components/outbox-banner';
import { RefreshFailed } from '@/components/refresh-failed';
import { RootRow } from '@/components/root-row';
import { SkeletonRow } from '@/components/skeleton-row';
import { WhoToFollow } from '@/components/who-to-follow';
import { useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, nextCursor, Unauthenticated } from '@/lib/client';
import { refetchFromTop } from '@/lib/query-client';
import { firstSeenId, rememberVisit, seenAt } from '@/lib/last-visit';
import { useNow } from '@/lib/now';
import { feedRows } from '@/lib/timeline';
import type { Commit, Page } from '@/lib/types';
import { useCommitHandlers } from '@/lib/use-commit-handlers';

export type LogName = 'following' | 'latest' | 'trending';

export type LogPageHandle = { scrollToTop: () => void };

const PollEvery = 30_000;

// Only the visible page polls. Polled commits that are newer than the list
// wait in the pill until tapped, so the list does not move under the finger.
export function LogPage({ log, active, onTrending, ref }: { log: LogName; active: boolean; onTrending: () => void; ref?: Ref<LogPageHandle> }) {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const queryClient = useQueryClient();
  const now = useNow();
  const base = useCommitHandlers();
  const list = useRef<FlashListRef<FeedItem>>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [held, setHeld] = useState<{ commits: Commit[]; count: number; more: boolean }>({ commits: [], count: 0, more: false });
  const [marker, setMarker] = useState<string | null>(null);
  const visitSeen = useRef<string | null | undefined>(undefined);
  const merged = useRef<Page<Commit> | undefined>(undefined);

  useImperativeHandle(ref, () => ({ scrollToTop: () => list.current?.scrollToOffset({ offset: 0, animated: true }) }), []);

  const query = useInfiniteQuery({
    queryKey: ['log', log],
    queryFn: ({ pageParam }) => api.log(log, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
    enabled: account.status === 'signed-in',
    refetchOnWindowFocus: false,
  });

  const commits = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);
  const newest = commits[0]?.id ?? null;
  const userId = account.user?.id;

  // The last-visit marker is computed once per opening and stays put until
  // the next pull to refresh.
  useEffect(() => {
    if (!query.isSuccess || userId === undefined || log === 'trending') {
      return;
    }

    if (visitSeen.current === undefined) {
      visitSeen.current = seenAt(userId, log);
      setMarker(firstSeenId(commits, visitSeen.current, userId));
    }

    rememberVisit(userId, log, commits);
  }, [query.isSuccess, commits, userId, log]);

  const poll = useQuery({
    queryKey: ['log-poll', log, newest],
    queryFn: () => api.log(log, null, newest),
    enabled: account.status === 'signed-in' && active && newest !== null,
    refetchInterval: PollEvery,
    staleTime: PollEvery,
    gcTime: 0,
  });

  useEffect(() => {
    const fresh = poll.data;

    if (!fresh || newest === null) {
      return;
    }

    const showing = new Set(commits.map((commit) => commit.id));
    const newer: Commit[] = [];
    const changed = new Map<string, Commit>();

    for (const commit of fresh.data) {
      if (showing.has(commit.id)) {
        changed.set(commit.id, commit);
      } else if (commit.id > newest) {
        newer.push(commit);
      }
    }

    if (merged.current !== fresh) {
      merged.current = fresh;

      if (changed.size > 0) {
        queryClient.setQueryData<InfiniteData<Page<Commit>>>(['log', log], (data) =>
          data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((commit) => changed.get(commit.id) ?? commit) })) } : data,
        );
      }
    }

    const count = Math.max(newer.length, fresh.new_commits_count ?? 0);

    // Poll results are external state mirrored into `held`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeld((current) => (current.count === count && current.commits.length === newer.length ? current : { commits: newer, count, more: fresh.new_commits_count === undefined && Boolean(nextCursor(fresh)) && newer.length === fresh.data.length }));
  }, [poll.data, newest, commits, log, queryClient]);

  useEffect(() => {
    if (query.error instanceof Unauthenticated) {
      account.signOut();
    }
  }, [query.error, account, router]);

  const threadQueries = useQueries({
    queries: openThreads.map((id) => ({ queryKey: ['thread', id], queryFn: () => api.replies(id) })),
  });

  const threads = useMemo(() => {
    const out: Record<string, { replies: Commit[]; hasMore: boolean } | null> = {};

    openThreads.forEach((id, index) => {
      const page = threadQueries[index]?.data;
      out[id] = page ? { replies: page.data, hasMore: nextCursor(page) !== null } : null;
    });

    return out;
  }, [openThreads, threadQueries]);

  const handlers = useMemo(
    () => ({
      ...base,
      onToggleReplies: (commit: Commit) => setOpenThreads((ids) => (ids.includes(commit.id) ? ids.filter((id) => id !== commit.id) : [...ids, commit.id])),
    }),
    [base],
  );

  const showNewCommits = useCallback(() => {
    if (held.commits.length > 0) {
      queryClient.setQueryData<InfiniteData<Page<Commit>>>(['log', log], (data) =>
        data && data.pages.length > 0 ? { ...data, pages: [{ ...data.pages[0], data: [...held.commits, ...data.pages[0].data] }, ...data.pages.slice(1)] } : data,
      );
    } else {
      void refetchFromTop(['log', log]);
    }

    setHeld({ commits: [], count: 0, more: false });
    list.current?.scrollToOffset({ offset: 0, animated: true });
  }, [held, log, queryClient]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setHeld({ commits: [], count: 0, more: false });
    setMarker(null);

    try {
      await refetchFromTop(['log', log]);
    } finally {
      setRefreshing(false);
    }
  }, [log]);

  const items = useMemo(() => feedItems(feedRows(commits, now, log !== 'trending', marker), threads), [commits, now, log, marker, threads]);
  const refreshFailed = query.isError && commits.length > 0;

  return (
    <View style={styles.page}>
      <Feed
        ref={list}
        items={items}
        viewerId={userId}
        handlers={handlers}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.inkMuted} />}
        ListHeaderComponent={
          <View>
            <OutboxBanner />
            {refreshFailed ? <RefreshFailed onRetry={() => query.refetch()} /> : null}
            {log === 'following' && commits.length > 0 ? <WhoToFollow /> : null}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <View>
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : query.isError ? (
            <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
          ) : log === 'following' ? (
            <FollowingEmpty suggestions={query.data?.pages[0]?.suggestions ?? []} onTrending={onTrending} onOpenAuthor={(username) => router.push({ pathname: '/users/[username]', params: { username } })} />
          ) : (
            <EmptyState fatal="fatal: no commits yet">Nobody has committed anything. Be the first. It’s just plain text; you’ll be fine.</EmptyState>
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <SkeletonRow /> : commits.length > 0 && !query.hasNextPage ? <RootRow /> : null}
      />

      <NewCommitsPill count={held.count} more={held.more} onPress={showNewCommits} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
