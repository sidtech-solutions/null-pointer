import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { DayMarker } from '@/components/day-marker';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { commitToOpen, NotificationRow } from '@/components/notification-row';
import { RootRow } from '@/components/root-row';
import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, nextCursor, Unauthenticated } from '@/lib/client';
import { dayKey, dayLabel } from '@/lib/display';
import { useNow } from '@/lib/now';
import type { CurrentUser, Notification } from '@/lib/types';

const Types: { key: string; label: string; empty: string }[] = [
  { key: 'all', label: 'All', empty: 'Nothing here yet. Follows, stars, replies, quotes, mentions, and moderation updates for your commits will show up here.' },
  { key: 'replies', label: 'Replies', empty: 'No replies yet. When someone replies to one of your commits, it shows up here.' },
  { key: 'quotes', label: 'Quotes', empty: 'No quotes yet. When someone quotes one of your commits, it shows up here.' },
  { key: 'stars', label: 'Stars', empty: 'No stars yet. When someone stars one of your commits, it shows up here.' },
  { key: 'mentions', label: 'Mentions', empty: 'No mentions yet. When someone mentions you in a commit, it shows up here.' },
  { key: 'follows', label: 'Follows', empty: 'No follows yet. When someone follows you, it shows up here.' },
  { key: 'moderation', label: 'Moderation', empty: 'No moderation updates yet.' },
];

type Row = { type: 'day'; key: string; label: string } | { type: 'notification'; key: string; notification: Notification; hasPrevious: boolean };

type Group = { items: Notification[]; hasMore: boolean; cursor: string | null; failed: boolean };

/**
 * The filters are pages you swipe between, as on the Log. Only the page showing
 * asks devnull, since every listing marks everything read.
 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const focused = useIsFocused();
  const pager = useRef<PagerView>(null);
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const filterX = useRef<number[]>([]);
  const [index, setIndex] = useState(0);

  // The strip scrolls so the filter you land on is in view.
  useEffect(() => {
    const x = filterX.current[index];

    if (x !== undefined) {
      strip.current?.scrollTo({ x: Math.max(0, x - 48), animated: true });
    }
  }, [index]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header title="Notifications" />
      <View style={[styles.filters, { borderBottomColor: theme.hairline, backgroundColor: theme.surface }]}>
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {Types.map((option, position) => (
            <Pressable
              key={option.key}
              onPress={() => pager.current?.setPage(position)}
              onLayout={(event) => {
                filterX.current[position] = event.nativeEvent.layout.x;
              }}
              style={styles.filter}
              accessibilityRole="tab"
              accessibilityState={{ selected: position === index }}>
              <Text variant="nav" muted={position !== index}>{option.label}</Text>
              <View style={[styles.underline, { backgroundColor: position === index ? theme.primary : 'transparent' }]} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <PagerView ref={pager} style={styles.pager} initialPage={0} onPageSelected={(event) => setIndex(event.nativeEvent.position)}>
        {Types.map((option, position) => (
          <View key={option.key} style={styles.page}>
            <NotificationsPage type={option.key} empty={option.empty} active={focused && position === index} onShowAll={() => pager.current?.setPage(0)} />
          </View>
        ))}
      </PagerView>
    </View>
  );
}

function NotificationsPage({ type, empty, active, onShowAll }: { type: string; empty: string; active: boolean; onShowAll: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const queryClient = useQueryClient();
  const now = useNow();
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Record<string, Group | null>>({});
  // Listing marks everything read on devnull, so "new" is judged against the previous load of this filter here.
  const seen = useRef<{ since: number; latest: number; updatedAt: number; pages: number } | undefined>(undefined);

  const query = useInfiniteQuery({
    queryKey: ['notifications', type],
    queryFn: ({ pageParam }) => api.notifications(type, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
    // Only while the page is showing: a background refetch would mark everything read unseen.
    enabled: account.status === 'signed-in' && active,
  });

  // Every listing, not only the first, marks everything read on the server, so
  // the badge drops at once. Loading older pages is not a new visit.
  useEffect(() => {
    const updatedAt = query.dataUpdatedAt;
    const pages = query.data?.pages.length ?? 0;
    const previous = seen.current;

    if (updatedAt === 0 || previous?.updatedAt === updatedAt) {
      return;
    }

    const paged = previous !== undefined && pages > previous.pages;
    seen.current = paged ? { ...previous, updatedAt, pages } : { since: previous?.latest ?? updatedAt, latest: updatedAt, updatedAt, pages };

    if (query.isFetchedAfterMount) {
      queryClient.setQueryData(['me'], (me: CurrentUser | undefined) => (me && me.unread_notifications_count !== 0 ? { ...me, unread_notifications_count: 0 } : me));
    }
  }, [query.dataUpdatedAt, query.data, query.isFetchedAfterMount, queryClient]);

  useEffect(() => {
    if (query.error instanceof Unauthenticated) {
      account.signOut().then(() => router.replace('/onboarding'));
    }
  }, [query.error, account, router]);

  const notifications = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let previousDay: string | null = null;

    notifications.forEach((notification) => {
      const day = notification.created_at ? dayKey(notification.created_at) : null;

      if (day !== null && day !== previousDay) {
        const label = dayLabel(notification.created_at!, now);
        out.push({ type: 'day', key: `day-${label}-${notification.id}`, label });
        previousDay = day;
        out.push({ type: 'notification', key: notification.id, notification, hasPrevious: false });
      } else {
        out.push({ type: 'notification', key: notification.id, notification, hasPrevious: out.length > 0 });
      }
    });

    return out;
  }, [notifications, now]);

  const isNew = useCallback((notification: Notification): boolean => {
    const since = seen.current?.since;

    if (since === undefined) {
      return false;
    }

    if ((notification.unread_count ?? 0) > 0 || notification.read_at === null) {
      return true;
    }

    const read = notification.read_at ? Date.parse(notification.read_at) : NaN;

    return !Number.isNaN(read) && read >= since - 60_000;
  }, []);

  const loadGroup = useCallback(
    async (notification: Notification, older = false) => {
      const current = open[notification.id];
      const cursor = older ? (current?.cursor ?? null) : null;

      try {
        const page = await api.notificationGroup(notification.group_id ?? notification.id, type, cursor);

        setOpen((state) => {
          const existing = older ? (state[notification.id]?.items ?? []) : [];

          return { ...state, [notification.id]: { items: [...existing, ...page.data], hasMore: nextCursor(page) !== null, cursor: nextCursor(page), failed: false } };
        });
      } catch {
        setOpen((state) => ({ ...state, [notification.id]: { items: state[notification.id]?.items ?? [], hasMore: false, cursor: null, failed: true } }));
      }
    },
    [open, type],
  );

  const toggleGroup = useCallback(
    (notification: Notification) => {
      if (notification.id in open) {
        setOpen((state) => {
          const next = { ...state };
          delete next[notification.id];

          return next;
        });

        return;
      }

      setOpen((state) => ({ ...state, [notification.id]: null }));
      loadGroup(notification);
    },
    [open, loadGroup],
  );

  const openNotification = useCallback(
    (notification: Notification) => {
      const commit = commitToOpen(notification);

      if (commit) {
        router.push({ pathname: '/commits/[id]', params: { id: commit } });
      } else if (notification.actor?.username) {
        router.push({ pathname: '/users/[username]', params: { username: notification.actor.username } });
      }
    },
    [router],
  );

  const refresh = async () => {
    setRefreshing(true);
    setOpen({});

    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlashList
      data={rows}
      keyExtractor={(row) => row.key}
      getItemType={(row) => row.type}
      renderItem={({ item }) =>
        item.type === 'day' ? (
          <DayMarker label={item.label} />
        ) : (
          <NotificationRow
            notification={item.notification}
            isNew={isNew(item.notification)}
            hasPrevious={item.hasPrevious}
            open={item.notification.id in open}
            group={open[item.notification.id]}
            onPress={openNotification}
            onToggleGroup={toggleGroup}
            onOpenItem={openNotification}
            onLoadOlder={(notification) => loadGroup(notification, true)}
            onOpenActor={(user) => router.push({ pathname: '/users/[username]', params: { username: user.username } })}
          />
        )
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.inkMuted} />}
      ListEmptyComponent={
        query.isPending ? null : query.isError ? (
          <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
        ) : (
          <EmptyState fatal={type === 'all' ? '$ cat /dev/notifications' : `$ cat /dev/notifications | grep ${type}`} action={type === 'all' ? undefined : 'All notifications'} onAction={onShowAll}>
            {empty}
          </EmptyState>
        )
      }
      ListFooterComponent={notifications.length > 0 && !query.hasNextPage ? <RootRow>That’s the oldest notification. There’s nothing before it.</RootRow> : null}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filters: { borderBottomWidth: StyleSheet.hairlineWidth },
  filterRow: { paddingHorizontal: Space.gutter - 8 },
  filter: { alignItems: 'center', paddingTop: 12, paddingHorizontal: 12, gap: 8 },
  underline: { height: 3, alignSelf: 'stretch', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  pager: { flex: 1 },
  page: { flex: 1 },
});
