import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { Feed, feedItems } from '@/components/feed';
import { Header } from '@/components/header';
import { RootRow } from '@/components/root-row';
import { SkeletonRow } from '@/components/skeleton-row';
import { Text } from '@/components/text';
import { useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, nextCursor } from '@/lib/client';
import { useNow } from '@/lib/now';
import { feedRows } from '@/lib/timeline';
import { useCommitHandlers } from '@/lib/use-commit-handlers';

export default function StarredScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const account = useAccount();
  const handlers = useCommitHandlers();
  const now = useNow();
  const [refreshing, setRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['log', 'starred'],
    queryFn: ({ pageParam }) => api.starred(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  const commits = useMemo(() => (query.data?.pages.flatMap((page) => page.data) ?? []).filter((commit) => commit.starred !== false), [query.data]);
  const items = useMemo(() => feedItems(feedRows(commits, now)), [commits, now]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Starred</Text>
          </View>
        }
      />
      <Feed
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        items={items}
        viewerId={account.user?.id}
        handlers={handlers}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await query.refetch();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={theme.inkMuted}
          />
        }
        ListEmptyComponent={
          query.isPending ? (
            <View>
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : query.isError ? (
            <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
          ) : (
            <EmptyState fatal="fatal: no starred commits yet" action="Find something on Trending." onAction={() => router.dismissTo({ pathname: '/(tabs)', params: { log: 'trending' } })}>
              Star a commit from your log and it shows up here.
            </EmptyState>
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <SkeletonRow /> : commits.length > 0 && !query.hasNextPage ? <RootRow>That was the first commit you starred.</RootRow> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
});
