import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { PersonSkeleton } from '@/components/person-skeleton';
import { Text } from '@/components/text';
import { laneColor, Space, useTheme } from '@/constants/theme';
import { api, ApiError, nextCursor } from '@/lib/client';
import type { Page, User } from '@/lib/types';

type Kind = 'muted' | 'blocked';

const Copy: Record<Kind, { label: string; description: string; undo: string; empty: string }> = {
  muted: {
    label: 'Muted',
    description: "Their commits and replies stay out of your logs, threads, search, and suggestions, and they can't notify you. They aren't told, and you can still visit their profile.",
    undo: 'Unmute',
    empty: "fatal: you haven't muted anyone",
  },
  blocked: {
    label: 'Blocked',
    description: "Neither of you can message, follow, reply to, or star the other, or see each other's commits. Unblocking doesn't bring back follows.",
    undo: 'Unblock',
    empty: "fatal: you haven't blocked anyone",
  },
};

export default function SafetyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>('muted');

  const query = useInfiniteQuery({
    queryKey: ['safety', kind],
    queryFn: ({ pageParam }) => (kind === 'muted' ? api.muted(pageParam) : api.blocked(pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  const undo = useMutation({
    mutationFn: (username: string) => (kind === 'muted' ? api.unmute(username) : api.unblock(username)),
    onSuccess: (_result, username) => {
      queryClient.setQueryData<InfiniteData<Page<User>>>(['safety', kind], (data) =>
        data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((user) => user.handle !== username) })) } : data,
      );
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['log'] });
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : `fatal: could not ${Copy[kind].undo.toLowerCase()}.`),
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
            <Text variant="name" style={styles.title}>Safety</Text>
          </View>
        }
        tabs={[
          { key: 'muted', label: 'Muted' },
          { key: 'blocked', label: 'Blocked' },
        ]}
        active={kind}
        onChange={setKind}
      />
      <FlashList
        data={people}
        keyExtractor={(user: User) => String(user.id ?? user.handle)}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        ListHeaderComponent={
          <View style={[styles.description, { borderBottomColor: theme.hairline }]}>
            <Text variant="small" muted>{Copy[kind].description}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/users/[username]', params: { username: item.handle } })} style={({ pressed }) => [styles.row, { borderBottomColor: theme.hairline }, pressed && { backgroundColor: theme.wash }]} accessibilityRole="button">
            <Avatar user={item} size={40} lane={laneColor(theme, item.lane)} />
            <View style={styles.column}>
              <Text variant="name" numberOfLines={1}>{item.name || item.handle}</Text>
              <Text variant="mono" muted numberOfLines={1}>@{item.handle}</Text>
            </View>
            <Button title={Copy[kind].undo} variant="outline" size="sm" busy={undo.isPending && undo.variables === item.handle} onPress={() => undo.mutate(item.handle)} />
          </Pressable>
        )}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={query.isPending ? <PersonSkeleton /> : query.isError ? <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} /> : <EmptyState fatal={Copy[kind].empty} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  description: { paddingHorizontal: Space.gutter, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  column: { flex: 1, gap: 2 },
});
