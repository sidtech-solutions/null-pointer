import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { type Ref, useMemo } from 'react';

import { CommitRow } from '@/components/commit-row';
import { type CommitHandlers } from '@/components/commit-actions';
import { DayMarker } from '@/components/day-marker';
import { LastVisitMarker } from '@/components/last-visit-marker';
import { ThreadReply } from '@/components/thread-reply';
import { laneColor, Space, useTheme } from '@/constants/theme';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RailSegment } from '@/components/graph-rail';
import type { FeedRow } from '@/lib/timeline';
import type { Commit } from '@/lib/types';

export type FeedItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'last-visit'; key: string }
  | { type: 'commit'; key: string; commit: Commit; continuesRun: boolean; continuesNext: boolean; threadBelow: boolean; repliesOpen: boolean }
  | { type: 'loading-replies'; key: string; railOn: boolean; lane: Commit['author']['lane'] }
  | { type: 'reply'; key: string; reply: Commit; commit: Commit; previous: Commit | null; hasNext: boolean; railOn: boolean; last: boolean; more: boolean };

// threads: replies opened in place, by commit id. null while loading. An open thread replaces the preview.
export function feedItems(rows: FeedRow[], threads: Record<string, { replies: Commit[]; hasMore: boolean } | null> = {}): FeedItem[] {
  const items: FeedItem[] = [];

  for (const row of rows) {
    if (row.type === 'day' || row.type === 'last-visit') {
      items.push(row);
      continue;
    }

    const deleted = typeof row.commit.deleted_at === 'string';
    const open = row.commit.id in threads;
    const thread = threads[row.commit.id];
    const replies = deleted ? [] : open ? (thread?.replies ?? []) : (row.commit.reply_preview?.data ?? []);
    const hasMore = !deleted && (open ? (thread?.hasMore ?? false) : Boolean(row.commit.reply_preview?.next_cursor));
    const loading = open && thread === null;

    items.push({ ...row, threadBelow: replies.length > 0 || loading, repliesOpen: open });

    if (loading) {
      items.push({ type: 'loading-replies', key: `loading-${row.commit.id}`, railOn: row.continuesNext, lane: row.commit.author?.lane });
    }

    replies.forEach((reply, index) => {
      const last = index === replies.length - 1;

      items.push({
        type: 'reply',
        key: `reply-${row.commit.id}-${reply.id}`,
        reply,
        commit: row.commit,
        previous: index === 0 ? null : replies[index - 1],
        hasNext: !last || hasMore,
        railOn: row.continuesNext,
        last,
        more: last && hasMore,
      });
    });
  }

  return items;
}

export function Feed({
  ref,
  items,
  viewerId,
  handlers,
  ...props
}: Omit<FlashListProps<FeedItem>, 'data' | 'renderItem' | 'keyExtractor' | 'getItemType'> & {
  ref?: Ref<FlashListRef<FeedItem>>;
  items: FeedItem[];
  viewerId: string | number | undefined;
  handlers: CommitHandlers;
}) {
  const theme = useTheme();
  const render = useMemo(
    () =>
      function renderItem({ item }: { item: FeedItem }) {
        switch (item.type) {
          case 'day':
            return <DayMarker label={item.label} />;
          case 'last-visit':
            return <LastVisitMarker />;
          case 'commit':
            return (
              <CommitRow
                commit={item.commit}
                previousLane={item.continuesRun ? laneColor(theme, item.commit.author?.lane) : undefined}
                continuesRun={item.continuesRun}
                continuesNext={item.continuesNext}
                threadBelow={item.threadBelow}
                repliesOpen={item.repliesOpen}
                viewerId={viewerId}
                handlers={handlers}
              />
            );
          case 'loading-replies':
            return (
              <View style={[styles.loading, { backgroundColor: theme.surface, borderBottomColor: theme.hairline }]}>
                <ActivityIndicator size="small" color={theme.inkMuted} />
                {item.railOn && <RailSegment lane={laneColor(theme, item.lane)} />}
              </View>
            );
          case 'reply':
            return (
              <ThreadReply
                reply={item.reply}
                lane={laneColor(theme, item.commit.author?.lane)}
                previousLane={item.previous ? laneColor(theme, item.previous.author?.lane) : undefined}
                hasNext={item.hasNext}
                railLane={item.railOn ? laneColor(theme, item.commit.author?.lane) : undefined}
                last={item.last}
                more={item.more ? () => handlers.onOpen?.(item.commit) : undefined}
                viewerId={viewerId}
                handlers={handlers}
              />
            );
        }
      },
    [theme, viewerId, handlers],
  );

  return <FlashList ref={ref} {...props} data={items} keyExtractor={(item) => item.key} getItemType={(item) => item.type} renderItem={render} />;
}

const styles = StyleSheet.create({
  loading: { paddingLeft: Space.rail, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
});
