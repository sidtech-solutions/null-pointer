import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, ChevronLeft, Link as LinkIcon, MapPin, Terminal } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { Feed, type FeedItem, feedItems } from '@/components/feed';
import { Header } from '@/components/header';
import { RootRow } from '@/components/root-row';
import { SkeletonRow } from '@/components/skeleton-row';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, nextCursor } from '@/lib/client';
import { openLink, websiteUrl } from '@/lib/links';
import { useNow } from '@/lib/now';
import { feedRows } from '@/lib/timeline';
import { useCommitHandlers } from '@/lib/use-commit-handlers';

/** A GitHub organization that commits mention: who it is, and every commit that mentions it, as the web's page shows. */
export default function OrganizationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const handlers = useCommitHandlers();
  const now = useNow();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const org = useQuery({ queryKey: ['organization', handle], queryFn: () => api.organization(handle), staleTime: 5 * 60_000 });

  const mentions = useInfiniteQuery({
    queryKey: ['organization-mentions', handle],
    queryFn: ({ pageParam }) => api.organizationMentions(handle, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  const list = useMemo(() => mentions.data?.pages.flatMap((page) => page.data) ?? [], [mentions.data]);
  const items = useMemo<FeedItem[]>(() => feedItems(feedRows(list, now)), [list, now]);

  const refresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([org.refetch(), mentions.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const data = org.data;

  const header = (
    <View style={{ backgroundColor: theme.surface }}>
      {org.isError && !data && <EmptyState fatal={org.error.message} action="Try again" onAction={() => org.refetch()} />}

      {data && (
        <View style={styles.header}>
          <View style={[styles.ring, { backgroundColor: theme.rail }]}>
            <View style={[styles.ringGap, { backgroundColor: theme.surface }]}>
              <Avatar user={{ name: data.name, handle: data.handle, avatar_url: data.avatar_url }} size={80} />
            </View>
          </View>

          <View style={styles.names}>
            <Text variant="title">{data.name || data.handle}</Text>
            <View style={styles.handle}>
              <Text variant="mono" muted numberOfLines={1} style={styles.shrink}>@{data.handle}</Text>
              <View style={[styles.chip, { backgroundColor: theme.wash }]}>
                <Text variant="small" muted style={styles.chipText}>Organization</Text>
              </View>
            </View>
          </View>

          {data.bio ? <Text>{data.bio}</Text> : null}

          <View style={styles.facts}>
            {data.location ? <Fact icon={<MapPin size={14} color={theme.inkMuted} strokeWidth={2} />} label={data.location} /> : null}
            {data.website ? <Fact icon={<LinkIcon size={14} color={theme.inkMuted} strokeWidth={2} />} label={data.website.replace(/^https?:\/\//, '')} onPress={() => openLink(websiteUrl(data.website!))} /> : null}
            <Fact icon={<Terminal size={14} color={theme.inkMuted} strokeWidth={2} />} label={`github.com/${data.handle}`} onPress={() => openLink(data.github_url)} />
          </View>
        </View>
      )}

      {!data && org.isPending && (
        <View style={styles.header}>
          <View style={[styles.ring, { backgroundColor: theme.wash }]} />
          <View style={[styles.skeletonBar, { backgroundColor: theme.wash, width: 160 }]} />
        </View>
      )}

      <View style={[styles.section, { borderTopColor: theme.hairline, borderBottomColor: theme.hairline }]}>
        <Building2 size={14} color={theme.inkMuted} strokeWidth={2} />
        <Text variant="mono" muted style={styles.sectionText}>commits mentioning @{handle}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="mono" style={styles.title}>@{handle}</Text>
          </View>
        }
      />
      <Feed
        items={items}
        viewerId={account.user?.id}
        handlers={handlers}
        ListHeaderComponent={header}
        onEndReached={() => {
          if (mentions.hasNextPage && !mentions.isFetchingNextPage) {
            mentions.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.inkMuted} />}
        ListEmptyComponent={
          mentions.isPending ? (
            <View>
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : mentions.isError ? (
            <EmptyState fatal={mentions.error.message} action="Try again" onAction={() => mentions.refetch()} />
          ) : (
            <EmptyState fatal="fatal: no mentions yet">{`Nobody has mentioned @${handle} in a commit yet.`}</EmptyState>
          )
        }
        ListFooterComponent={mentions.isFetchingNextPage ? <SkeletonRow /> : list.length > 0 && !mentions.hasNextPage ? <RootRow>{`That's the first mention of @${handle}.`}</RootRow> : null}
      />
    </View>
  );
}

function Fact({ icon, label, onPress }: { icon: ReactNode; label: string; onPress?: () => void }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.fact} accessibilityLabel={label}>
      <View style={styles.factIcon}>{icon}</View>
      <Text variant="small" color={onPress ? theme.primary : theme.inkMuted} numberOfLines={1} style={styles.shrink}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15 },
  header: { paddingHorizontal: Space.gutter, paddingTop: 24, paddingBottom: 16, gap: 16 },
  ring: { width: 92, height: 92, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ringGap: { width: 88, height: 88, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  names: { gap: 4 },
  handle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  chipText: { fontSize: 12, lineHeight: 16 },
  facts: { gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factIcon: { width: 16, alignItems: 'center' },
  skeletonBar: { height: 14, borderRadius: Radius.sm },
  section: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Space.gutter, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionText: { fontSize: 12, lineHeight: 16 },
});
