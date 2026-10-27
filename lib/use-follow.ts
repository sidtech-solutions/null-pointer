import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api, ApiError } from './client';
import type { Connection, Notification, Page, Profile } from './types';

// Optimistic: patches every cached copy of the user immediately, rolls back on error.
export function useFollow() {
  const queryClient = useQueryClient();

  const apply = (username: string, isFollowing: boolean, delta: number) => {
    queryClient.setQueriesData<Profile>({ queryKey: ['profile', username] }, (profile) =>
      profile ? { ...profile, is_following: isFollowing, followers_count: Math.max(0, profile.followers_count + delta) } : profile,
    );
    queryClient.setQueriesData<InfiniteData<Page<Connection>>>({ queryKey: ['connections'] }, (data) =>
      data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((c) => (c.user.handle === username ? { ...c, is_followed: isFollowing } : c)) })) } : data,
    );
    queryClient.setQueriesData<InfiniteData<Page<Notification>>>({ queryKey: ['notifications'] }, (data) =>
      data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((n) => (n.actor?.handle === username ? { ...n, actor: { ...n.actor, is_followed: isFollowing } } : n)) })) } : data,
    );
  };

  return useMutation({
    mutationFn: ({ username, isFollowing }: { username: string; isFollowing: boolean }) => (isFollowing ? api.unfollow(username) : api.follow(username)),
    onMutate: ({ username, isFollowing }) => apply(username, !isFollowing, isFollowing ? -1 : 1),
    onError: (error, { username, isFollowing }) => {
      apply(username, isFollowing, isFollowing ? 1 : -1);
      Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not follow.');
    },
    onSuccess: (_result, { username }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['log', 'following'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
