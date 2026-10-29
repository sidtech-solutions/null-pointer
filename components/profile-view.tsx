import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building2, CalendarDays, Clock, Ellipsis, Link as LinkIcon, MapPin, MessageSquare, Pin, Radio, Star, Terminal } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AchievementsShelf } from '@/components/achievements';
import { ActivityGraph } from '@/components/activity-graph';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { CommitRow } from '@/components/commit-row';
import { EmptyState } from '@/components/empty-state';
import { Feed, type FeedItem, feedItems } from '@/components/feed';
import { FollowButton } from '@/components/follow-button';
import { LiveBadge, platformName } from '@/components/live-badge';
import { RootRow } from '@/components/root-row';
import { SkeletonRow } from '@/components/skeleton-row';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, nextCursor } from '@/lib/client';
import { useNow } from '@/lib/now';
import { feedRows } from '@/lib/timeline';
import type { Profile } from '@/lib/types';
import { useCommitHandlers } from '@/lib/use-commit-handlers';
import { openLink, websiteUrl } from '@/lib/links';

type Tab = 'commits' | 'replies';

const Tabs: { key: Tab; label: string }[] = [
  { key: 'commits', label: 'Commits' },
  { key: 'replies', label: 'Replies' },
];

const Months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ProfileView({ username, onOpenConnections, onOpenStarred, onOpenScheduled, footer }: { username: string; onOpenConnections: (type: 'followers' | 'following') => void; onOpenStarred?: () => void; onOpenScheduled?: () => void; footer?: ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const handlers = useCommitHandlers();
  const now = useNow();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled: account.status === 'signed-in', staleTime: 60_000 });
  const canPush = me.data?.remotes !== null && me.data?.remotes !== undefined;

  const safety = useMutation({
    mutationFn: ({ action }: { action: 'mute' | 'unmute' | 'block' | 'unblock' }) => api[action](username),
    onSuccess: (_result, { action }) => {
      queryClient.setQueryData(['profile', username], (data: Profile | undefined) =>
        data ? { ...data, is_muting: action === 'mute' ? true : action === 'unmute' ? false : data.is_muting, is_following: action === 'block' ? false : data.is_following } : data,
      );
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['safety'] });
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: something went wrong.'),
  });

  const more = () => {
    const handle = `@${username}`;
    const muting = profile.data?.is_muting ?? false;
    const options = [muting ? 'Unmute' : 'Mute', 'Block', 'Cancel'];
    const act = (picked: string) => {
      if (picked === 'Mute') {
        Alert.alert(`Mute ${handle}?`, "You won't see their commits or hear from them, and they won't be told.", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mute', onPress: () => safety.mutate({ action: 'mute' }) },
        ]);
      } else if (picked === 'Unmute') {
        Alert.alert(`Unmute ${handle}?`, '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unmute', onPress: () => safety.mutate({ action: 'unmute' }) },
        ]);
      } else if (picked === 'Block') {
        Alert.alert(`Block ${handle}?`, "You'll stop following each other. Neither of you will be able to see the other's commits, reply, star, or message. Unblocking doesn't bring back follows.", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: () => safety.mutate({ action: 'block' }) },
        ]);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2, destructiveButtonIndex: 1 }, (index) => act(options[index]));
    } else {
      Alert.alert(handle, undefined, [
        { text: options[0], onPress: () => act(options[0]) },
        { text: 'Block', style: 'destructive', onPress: () => act('Block') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };
  const [tab, setTab] = useState<Tab>('commits');
  const [refreshing, setRefreshing] = useState(false);

  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username) });

  const commits = useInfiniteQuery({
    queryKey: ['user-commits', username, tab],
    queryFn: ({ pageParam }) => api.userCommits(username, tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  const user = profile.data?.user;
  const isMe = account.user?.handle === username;
  const lane = laneColor(theme, user?.lane);
  const list = useMemo(() => commits.data?.pages.flatMap((page) => page.data) ?? [], [commits.data]);
  const items = useMemo<FeedItem[]>(() => feedItems(feedRows(list, now)), [list, now]);

  const refresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([profile.refetch(), commits.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <View style={{ backgroundColor: theme.surface }}>
      {profile.isError && !user && <EmptyState fatal={profile.error.message} action="Try again" onAction={() => profile.refetch()} />}

      {user && (
        <View style={styles.header}>
          <View style={styles.top}>
            <View style={[styles.ring, { backgroundColor: lane }]}>
              <View style={[styles.ringGap, { backgroundColor: theme.surface }]}>
                <Avatar user={user} size={80} />
              </View>
            </View>
            {isMe ? (
              <View style={styles.actions}>
                {onOpenScheduled && (
                  <Pressable onPress={onOpenScheduled} style={[styles.iconButton, { backgroundColor: theme.shell, borderColor: theme.rail }]} accessibilityRole="button" accessibilityLabel="Scheduled commits">
                    <Clock size={16} color={theme.ink} strokeWidth={2} />
                  </Pressable>
                )}
                {onOpenStarred && (
                  <Pressable onPress={onOpenStarred} style={[styles.iconButton, { backgroundColor: theme.shell, borderColor: theme.rail }]} accessibilityRole="button" accessibilityLabel="Starred commits">
                    <Star size={16} color={theme.ink} strokeWidth={2} />
                  </Pressable>
                )}
                <Button title="Edit on GitHub" variant="outline" size="sm" onPress={() => openLink('https://github.com/settings/profile')} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable onPress={more} style={[styles.iconButton, { backgroundColor: theme.shell, borderColor: theme.rail }]} accessibilityRole="button" accessibilityLabel="More">
                  <Ellipsis size={16} color={theme.ink} strokeWidth={2} />
                </Pressable>
                {canPush && (
                  <Pressable onPress={() => router.push({ pathname: '/remotes/[target]', params: { target: `@${username}` } })} style={[styles.iconButton, { backgroundColor: theme.shell, borderColor: theme.rail }]} accessibilityRole="button" accessibilityLabel={`Push a message to @${username}`}>
                    <MessageSquare size={16} color={theme.ink} strokeWidth={2} />
                  </Pressable>
                )}
                <FollowButton username={username} isFollowing={profile.data?.is_following ?? false} />
              </View>
            )}
          </View>

          <View style={styles.names}>
            <Text variant="title">{user.name || user.handle}</Text>
            <View style={styles.handle}>
              <View style={[styles.dot, { backgroundColor: lane }]} />
              <Text variant="mono" muted numberOfLines={1} style={styles.shrink}>@{user.handle}</Text>
              {user.live && <LiveBadge stream={user.live} size="md" />}
              {profile.data?.follows_you && (
                <View style={[styles.chip, { backgroundColor: theme.wash }]}>
                  <Text variant="small" muted style={styles.chipText}>Follows you</Text>
                </View>
              )}
              {profile.data?.is_muting && (
                <View style={[styles.chip, { backgroundColor: theme.wash }]}>
                  <Text variant="small" muted style={styles.chipText}>Muted</Text>
                </View>
              )}
              {profile.data?.achievements && (
                <View style={[styles.rank, { borderColor: `${lane}40`, backgroundColor: `${lane}1a` }]} accessibilityLabel={`Level ${profile.data.achievements.level}, ${profile.data.achievements.rank}`}>
                  <Text variant="monoMedium" color={lane} style={styles.rankText}>
                    Lv. {profile.data.achievements.level} · {profile.data.achievements.rank}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {user.bio ? <Text>{user.bio}</Text> : null}

          <View style={styles.facts}>
            {user.live ? <Fact icon={<Radio size={14} color={theme.inkMuted} strokeWidth={2} />} label={`Live now on ${platformName(user.live.platform)}`} onPress={() => openLink(user.live!.url)} /> : null}
            {user.company ? <Fact icon={<Building2 size={14} color={theme.inkMuted} strokeWidth={2} />} label={user.company} /> : null}
            {user.location ? <Fact icon={<MapPin size={14} color={theme.inkMuted} strokeWidth={2} />} label={user.location} /> : null}
            {user.website ? <Fact icon={<LinkIcon size={14} color={theme.inkMuted} strokeWidth={2} />} label={user.website.replace(/^https?:\/\//, '')} onPress={() => openLink(websiteUrl(user.website!))} /> : null}
            <Fact icon={<Terminal size={14} color={theme.inkMuted} strokeWidth={2} />} label={`github.com/${user.handle}`} onPress={() => openLink(user.github_url ?? `https://github.com/${user.handle}`)} />
            {user.created_at ? <Fact icon={<CalendarDays size={14} color={theme.inkMuted} strokeWidth={2} />} label={`Joined ${joined(user.created_at)}`} /> : null}
          </View>

          {profile.data && (
            <View style={styles.counts}>
              <Count value={profile.data.commits_count} singular="commit" plural="commits" />
              <Count value={profile.data.following_count} singular="following" plural="following" onPress={() => onOpenConnections('following')} />
              <Count value={profile.data.followers_count} singular="follower" plural="followers" onPress={() => onOpenConnections('followers')} />
            </View>
          )}

          {profile.data && profile.data.streaks.longest > 0 && (
            <View style={styles.streaks}>
              <Text variant="mono" muted>longest streak </Text>
              <Text variant="mono">{profile.data.streaks.longest} {profile.data.streaks.longest === 1 ? 'day' : 'days'}</Text>
              {profile.data.streaks.current > 0 && (
                <>
                  <Text variant="mono" muted> · current </Text>
                  <View style={[styles.dot, { backgroundColor: lane, marginRight: 4 }]} />
                  <Text variant="mono">{profile.data.streaks.current}</Text>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {profile.data?.activity && <ActivityGraph activity={profile.data.activity} lane={lane} />}
      {profile.data?.achievements && <AchievementsShelf achievements={profile.data.achievements} lane={lane} handle={username} />}

      {!user && profile.isPending && (
        <View style={styles.header}>
          <View style={[styles.ring, { backgroundColor: theme.wash }]} />
          <View style={[styles.skeletonBar, { backgroundColor: theme.wash, width: 160 }]} />
          <View style={[styles.skeletonBar, { backgroundColor: theme.wash, width: 100 }]} />
        </View>
      )}

      <View style={[styles.tabs, { borderTopColor: theme.hairline, borderBottomColor: theme.hairline }]}>
        {Tabs.map((option) => (
          <Pressable key={option.key} onPress={() => setTab(option.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: option.key === tab }}>
            <Text variant="nav" muted={option.key !== tab}>{option.label}</Text>
            <View style={[styles.underline, { backgroundColor: option.key === tab ? lane : 'transparent' }]} />
          </Pressable>
        ))}
      </View>

      {tab === 'commits' && profile.data?.pinned_commit && (
        <>
          <View style={styles.pinned}>
            <Pin size={12} color={theme.inkMuted} strokeWidth={2} />
            <Text variant="mono" muted style={styles.pinnedText}>Pinned</Text>
          </View>
          <CommitRow commit={profile.data.pinned_commit} continuesNext={false} viewerId={account.user?.id} handlers={handlers} />
        </>
      )}
    </View>
  );

  const handle = `@${username}`;

  return (
    <Feed
      items={items}
      viewerId={account.user?.id}
      handlers={handlers}
      ListHeaderComponent={header}
      onEndReached={() => {
        if (commits.hasNextPage && !commits.isFetchingNextPage) {
          commits.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.inkMuted} />}
      ListEmptyComponent={
        commits.isPending ? (
          <View>
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </View>
        ) : commits.isError ? (
          <EmptyState fatal={commits.error.message} action="Try again" onAction={() => commits.refetch()} />
        ) : tab === 'replies' ? (
          <EmptyState fatal="fatal: no replies yet">{isMe ? 'Your replies show up here. Join a conversation from your log.' : `${handle} hasn't replied to anything yet.`}</EmptyState>
        ) : (
          <EmptyState fatal={isMe ? 'fatal: you do not have any commits yet' : 'fatal: no commits yet'}>{isMe ? 'Your commits show up here. Make your first one from your log.' : `${handle} hasn't committed anything yet.`}</EmptyState>
        )
      }
      ListFooterComponent={
        <>
          {commits.isFetchingNextPage ? (
            <SkeletonRow />
          ) : list.length > 0 && !commits.hasNextPage ? (
            <RootRow>{tab === 'replies' ? (isMe ? 'That was your first reply.' : `That's ${handle}'s first reply.`) : isMe ? 'That was your first commit. Everyone starts somewhere.' : `That's ${handle}'s root commit.`}</RootRow>
          ) : null}
          {footer}
        </>
      }
    />
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

function Count({ value, singular, plural, onPress }: { value: number; singular: string; plural: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.count} accessibilityLabel={`${value} ${value === 1 ? singular : plural}`}>
      <Text variant="monoMedium">{value}</Text>
      <Text variant="small" muted>{value === 1 ? singular : plural}</Text>
    </Pressable>
  );
}

function joined(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : `${Months[date.getMonth()]} ${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.gutter, paddingTop: 24, paddingBottom: 16, gap: 16 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 92, height: 92, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ringGap: { width: 88, height: 88, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  names: { gap: 4 },
  handle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  shrink: { flexShrink: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  chipText: { fontSize: 12, lineHeight: 16 },
  rank: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  rankText: { fontSize: 11, lineHeight: 14 },
  facts: { gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factIcon: { width: 16, alignItems: 'center' },
  counts: { flexDirection: 'row', gap: 16 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streaks: { flexDirection: 'row', alignItems: 'center' },
  skeletonBar: { height: 14, borderRadius: Radius.sm },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, gap: 10 },
  underline: { height: 3, width: 64, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: Space.rail, paddingTop: 12 },
  pinnedText: { fontSize: 12, lineHeight: 16 },
});
