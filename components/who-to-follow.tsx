import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { LiveBadge } from '@/components/live-badge';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api } from '@/lib/client';
import { toast } from '@/lib/toast';
import type { SuggestedUser } from '@/lib/types';

const Shown = 3;

function reasonFor(user: SuggestedUser): string | null {
  const count = user.followed_by_following_count ?? 0;

  if (count > 0) {
    return `Followed by ${count} you follow`;
  }

  return user.follows_you ? 'Follows you' : null;
}

/**
 * The day's picks of people to follow, as the web's aside shows them: a few at
 * a time, each with why, a way to see the next few, and a way to say never.
 * Beside a profile or a commit, that developer's people come first.
 */
export function WhoToFollow({ context, title = 'who to follow' }: { context?: { handle?: string | null; commitId?: string | null }; title?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const [round, setRound] = useState(0);
  const [gone, setGone] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ['suggested-users', round, context?.handle ?? null, context?.commitId ?? null],
    queryFn: () => api.suggestedUsers(round, context),
    enabled: account.status === 'signed-in',
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
    retry: false,
  });

  const dismiss = useMutation({
    mutationFn: (user: SuggestedUser) => api.dismissSuggestion(user.handle),
    onMutate: (user) => setGone((list) => [...list, user.handle]),
    onError: (_error, user) => {
      setGone((list) => list.filter((handle) => handle !== user.handle));
      toast('Could not dismiss the suggestion. Try again.');
    },
  });

  // The server sends spares after the page, so a dismissed row makes room for the next one.
  const people = (query.data ?? []).filter((user) => !gone.includes(user.handle) && String(user.id) !== String(account.user?.id)).slice(0, Shown);

  if (people.length === 0) {
    return null;
  }

  return (
    <View style={[styles.wrap, { borderBottomColor: theme.hairline }]}>
      <View style={styles.heading}>
        <Text variant="mono" muted style={styles.title}>{title}</Text>
        <Pressable onPress={() => setRound((current) => current + 1)} hitSlop={8} disabled={query.isFetching} accessibilityRole="button" accessibilityLabel="Show other people" style={{ opacity: query.isFetching ? 0.4 : 1 }}>
          <RefreshCw size={14} color={theme.inkMuted} strokeWidth={2} />
        </Pressable>
      </View>

      {people.map((user) => {
        const reason = reasonFor(user);

        return (
          <View key={String(user.id)} style={styles.row}>
            <Pressable onPress={() => router.push({ pathname: '/users/[username]', params: { username: user.handle } })} style={styles.person} accessibilityRole="button" accessibilityLabel={`${user.name || user.handle}'s profile`}>
              <Avatar user={user} size={40} lane={laneColor(theme, user.lane)} />
              <View style={styles.names}>
                <View style={styles.nameRow}>
                  <Text variant="name" numberOfLines={1} style={[styles.shrink, styles.name]}>{user.name || user.handle}</Text>
                  {user.live && <LiveBadge stream={user.live} />}
                </View>
                <Text variant="mono" muted numberOfLines={1} style={styles.tiny}>@{user.handle}</Text>
                {reason && <Text variant="small" muted numberOfLines={1} style={styles.tiny}>{reason}</Text>}
              </View>
            </Pressable>
            <FollowButton username={user.handle} isFollowing={user.is_followed === true} />
            <Pressable onPress={() => dismiss.mutate(user)} hitSlop={8} style={styles.dismiss} accessibilityRole="button" accessibilityLabel={`Not interested. @${user.handle} won't be suggested again`}>
              <X size={16} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingLeft: Space.rail, paddingRight: Space.gutter, paddingTop: 12, paddingBottom: 8, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  title: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  names: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14 },
  shrink: { flexShrink: 1 },
  tiny: { fontSize: 12, lineHeight: 16 },
  dismiss: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
