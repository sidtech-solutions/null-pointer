import { FlashList } from '@shopify/flash-list';
import { type InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Clock } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CommitBody } from '@/components/commit-body';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { api, ApiError } from '@/lib/client';
import { scheduleLabel } from '@/lib/schedule';
import { toast } from '@/lib/toast';
import type { ScheduledCommit, ScheduledStatus } from '@/lib/types';

type Pages = InfiniteData<{ data: ScheduledCommit[]; next: number | null }>;

const StatusLabel: Record<ScheduledStatus, string> = {
  scheduled: 'scheduled',
  pending: 'waiting for approval',
  approved: 'committed',
  rejected: 'rejected',
  deleted: 'deleted',
};

/** The queue only the user sees: what waits, when, and what became of what already went. */
export default function ScheduledScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['scheduled'],
    queryFn: ({ pageParam }) => api.scheduledCommits(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next,
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const failed = (error: unknown, fallback: string) => {
    Alert.alert(error instanceof ApiError ? error.firstError() : fallback);
    queryClient.invalidateQueries({ queryKey: ['scheduled'] });
  };

  const replace = (updated: ScheduledCommit) =>
    queryClient.setQueryData<Pages>(['scheduled'], (data) => (data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((row) => (row.id === updated.id ? updated : row)) })) } : data));

  const submit = useMutation({
    mutationFn: (scheduled: ScheduledCommit) => api.submitScheduledCommit(scheduled.id),
    onSuccess: (updated) => {
      replace(updated);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled'] });
      toast(updated.status === 'pending' ? 'Committed. It waits for approval.' : 'Committed.');
    },
    onError: (error) => failed(error, 'fatal: could not commit it now.'),
  });

  const cancel = useMutation({
    mutationFn: (scheduled: ScheduledCommit) => api.cancelScheduledCommit(scheduled.id),
    onSuccess: (_result, scheduled) => {
      queryClient.setQueryData<Pages>(['scheduled'], (data) => (data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((row) => row.id !== scheduled.id) })) } : data));
      toast('Canceled. The draft is gone.');
    },
    onError: (error) => failed(error, 'fatal: could not cancel it.'),
  });

  const confirmCancel = (scheduled: ScheduledCommit) =>
    Alert.alert('Cancel this commit?', 'The text, images and poll are not kept.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel commit', style: 'destructive', onPress: () => cancel.mutate(scheduled) },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Scheduled commits</Text>
          </View>
        }
      />

      <FlashList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        renderItem={({ item }) => {
          const waiting = item.status === 'scheduled';
          const busy = (submit.isPending && submit.variables?.id === item.id) || (cancel.isPending && cancel.variables?.id === item.id);
          const extras = [item.image_count > 0 ? `${item.image_count} ${item.image_count === 1 ? 'image' : 'images'}` : null, item.poll_options ? `poll with ${item.poll_options.length} options` : null].filter(Boolean).join(' · ');

          return (
            <View style={[styles.row, { borderBottomColor: theme.hairline }]}>
              <View style={styles.meta}>
                <Clock size={14} color={waiting ? theme.primary : theme.inkMuted} strokeWidth={2} />
                <Text variant="mono" color={waiting ? theme.primary : theme.inkMuted} numberOfLines={1} style={styles.shrink}>{scheduleLabel(item.scheduled_at)}</Text>
                <View style={[styles.chip, { backgroundColor: theme.wash }]}>
                  <Text variant="mono" muted style={styles.tiny}>{StatusLabel[item.status] ?? item.status}</Text>
                </View>
              </View>

              {item.body ? <CommitBody body={item.body} segments={item.body_segments} size={15} numberOfLines={8} /> : <Text variant="small" muted>{item.status === 'scheduled' ? 'No text.' : 'The text went with the commit.'}</Text>}
              {extras !== '' && <Text variant="mono" muted style={styles.tiny}>{extras}</Text>}

              {waiting && (
                <View style={styles.actions}>
                  <Button title="Commit now" size="sm" busy={busy && submit.isPending} disabled={busy} onPress={() => submit.mutate(item)} />
                  <Button title="Cancel" size="sm" variant="outline" busy={busy && cancel.isPending} disabled={busy} onPress={() => confirmCancel(item)} />
                </View>
              )}
            </View>
          );
        }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          query.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          ) : query.isError ? (
            <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
          ) : (
            <EmptyState fatal="$ git log --future">Nothing scheduled. The clock in the composer queues a commit for later, up to thirty days ahead and ten at a time.</EmptyState>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={theme.inkMuted} />
            </View>
          ) : null
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
  row: { paddingHorizontal: Space.gutter, paddingVertical: 14, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.sm },
  tiny: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  loading: { paddingVertical: 32, alignItems: 'center' },
});
