import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { FollowButton } from '@/components/follow-button';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, nextCursor } from '@/lib/client';
import type { Connection } from '@/lib/types';

export default function ConnectionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const params = useLocalSearchParams<{ username: string; type: string }>();
  const type: 'followers' | 'following' = params.type === 'following' ? 'following' : 'followers';

  const query = useInfiniteQuery({
    queryKey: ['connections', params.username, type],
    queryFn: ({ pageParam }) => api.connections(params.username, type, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  const people = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>{type === 'following' ? 'Following' : 'Followers'}</Text>
            <Text variant="mono" muted>@{params.username}</Text>
          </View>
        }
      />
      <FlashList
        data={people}
        keyExtractor={(item: Connection) => String(item.user.id ?? item.user.username)}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/users/[username]', params: { username: item.user.username } })} style={[styles.row, { borderBottomColor: theme.hairline }]}>
            <Avatar user={item.user} size={40} lane={laneColor(theme, item.user.lane)} />
            <View style={styles.column}>
              <View style={styles.names}>
                <Text variant="name" numberOfLines={1} style={styles.shrink}>{item.user.name || item.user.username}</Text>
                {item.follows_you && (
                  <View style={[styles.chip, { backgroundColor: theme.wash }]}>
                    <Text variant="small" muted style={styles.chipText}>Follows you</Text>
                  </View>
                )}
              </View>
              <Text variant="mono" muted numberOfLines={1}>@{item.user.username}</Text>
              {item.user.bio ? <Text variant="small" numberOfLines={2}>{item.user.bio}</Text> : null}
            </View>
            {account.user?.username !== item.user.username && <FollowButton username={item.user.username} isFollowing={item.is_followed} />}
          </Pressable>
        )}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          query.isPending ? null : query.isError ? (
            <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
          ) : (
            <EmptyState fatal={type === 'following' ? 'fatal: not following anyone' : 'fatal: no followers yet'} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  column: { flex: 1, gap: 2 },
  names: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.sm },
  chipText: { fontSize: 12, lineHeight: 16 },
});
