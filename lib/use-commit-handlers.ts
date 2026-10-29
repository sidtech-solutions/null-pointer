import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import type { CommitHandlers } from '@/components/commit-actions';
import { api, ApiError, Unauthenticated } from '@/lib/client';
import { patchCommit, removeCommit } from '@/lib/commit-cache';
import { shortHash } from '@/lib/display';
import { tap } from '@/lib/haptics';
import { reportCommit } from '@/lib/report-store';
import { toast } from '@/lib/toast';
import { translationLanguage } from '@/lib/translation';
import type { Commit, Page, Profile } from '@/lib/types';

import { useAccount } from './account';

// Stars are optimistic with rollback on error. Every write patches all cached copies of the commit.
export function useCommitHandlers(): CommitHandlers {
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled: account.status === 'signed-in', staleTime: 60_000 });
  const pasteisLeft = me.data?.pasteis_mode ? (me.data.pasteis_remaining ?? 10) : null;

  const star = useMutation({
    mutationFn: (commit: Commit) => (commit.starred ? api.unstar(commit.id) : api.star(commit.id)),
    onMutate: (commit) => {
      patchCommit(queryClient, commit.id, (c) => ({ ...c, starred: !commit.starred, stars_count: Math.max(0, c.stars_count + (commit.starred ? -1 : 1)) }));
    },
    onSuccess: (updated) => {
      if (updated?.id) {
        patchCommit(queryClient, updated.id, (c) => ({ ...c, starred: updated.starred, stars_count: updated.stars_count }));
      }
    },
    onError: (error, commit) => {
      patchCommit(queryClient, commit.id, (c) => ({ ...c, starred: commit.starred, stars_count: commit.stars_count }));
      failed(error);
    },
  });

  // The server keeps a deleted commit for 30 s; the toast offers Undo for a little less, so a late tap never fails.
  const restore = useMutation({
    mutationFn: (commit: Commit) => api.restoreCommit(commit.id),
    onSuccess: (restored, commit) => {
      toast(`Restored ${restored.short_hash || commit.short_hash || shortHash(commit.id)}.`);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      queryClient.invalidateQueries({ queryKey: ['user-commits'] });
      queryClient.invalidateQueries({ queryKey: ['commit', commit.id] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.firstError() : 'fatal: could not restore the commit.', 4_000),
  });

  const remove = useMutation({
    mutationFn: (commit: Commit) => api.deleteCommit(commit.id),
    onSuccess: (_result, commit) => {
      toast(`rm ${commit.short_hash || shortHash(commit.id)} → /dev/null`, 27_000, { label: 'Undo', run: () => restore.mutate(commit) });
      removeCommit(queryClient, commit.id);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: failed,
  });

  // A translation is kept on every cached copy of the commit and shown in place of the body until Show original.
  const translate = useMutation({
    mutationFn: async (commit: Commit) => api.translateCommit(commit.id, await translationLanguage(queryClient)),
    onMutate: (commit) => toast(`Translating ${commit.short_hash || shortHash(commit.id)}…`, 6_000),
    onSuccess: (translation, commit) => {
      if (!translation || !translation.available) {
        toast(translation?.source_name ? `Already in ${translation.source_name}.` : 'Nothing to translate yet. Try again in a moment.');

        return;
      }

      if (!translation.translated) {
        toast('The translation is on its way. Try again in a moment.');

        return;
      }

      patchCommit(queryClient, commit.id, (c) => ({ ...c, translation, translated: true }));
    },
    onError: (error) => toast(error instanceof ApiError ? error.firstError() : 'Could not translate this commit. Try again.', 4_000),
  });

  const vote = useMutation({
    mutationFn: ({ commit, optionId }: { commit: Commit; optionId: string }) => api.votePoll(commit.id, optionId),
    onMutate: ({ commit, optionId }) => {
      patchCommit(queryClient, commit.id, (c) =>
        c.poll ? { ...c, poll: { ...c.poll, has_voted: true, votes_count: (c.poll.votes_count ?? 0) + 1, options: c.poll.options.map((option) => (option.id === optionId ? { ...option, voted: true, votes_count: (option.votes_count ?? 0) + 1 } : option)) } } : c,
      );
    },
    onSuccess: (updated) => {
      if (updated?.id) {
        patchCommit(queryClient, updated.id, (c) => ({ ...c, poll: updated.poll ?? c.poll }));
      }
    },
    onError: (error, { commit }) => {
      patchCommit(queryClient, commit.id, (c) => ({ ...c, poll: commit.poll }));
      failed(error);
    },
  });

  // Pinning needs PUT commits/{id}/pin, which dev-null.sh may not serve yet; a 404 says so instead of failing quietly.
  const pin = useMutation({
    mutationFn: (commit: Commit) => (commit.is_pinned ? api.unpin(commit.id) : api.pin(commit.id)),
    onSuccess: (updated, commit) => {
      const pinned = updated?.is_pinned ?? !commit.is_pinned;

      queryClient.setQueriesData<Profile>({ queryKey: ['profile', account.user?.handle] }, (profile) => (profile ? { ...profile, pinned_commit: pinned ? { ...commit, is_pinned: true } : profile.pinned_commit?.id === commit.id ? null : profile.pinned_commit } : profile));
      patchCommit(queryClient, commit.id, (c) => ({ ...c, is_pinned: pinned }));

      if (pinned) {
        // Only one commit is pinned at a time, so any other copy marked pinned is stale.
        queryClient.setQueriesData<InfiniteData<Page<Commit>>>({ queryKey: ['user-commits', account.user?.handle] }, (data) =>
          data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((c) => (c.id !== commit.id && c.is_pinned ? { ...c, is_pinned: false } : c)) })) } : data,
        );
      }

      toast(pinned ? `Pinned ${commit.short_hash || shortHash(commit.id)} to your profile.` : `Unpinned ${commit.short_hash || shortHash(commit.id)}.`);
      queryClient.invalidateQueries({ queryKey: ['profile', account.user?.handle] });
    },
    onError: (error) => {
      // Production answers 405 to a route it does not have yet; a 404 would mean the commit is gone.
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        toast('Pinning from the app needs a newer dev-null.sh.');

        return;
      }

      failed(error);
    },
  });

  const pastel = useMutation({
    mutationFn: (commit: Commit) => api.givePastel(commit.id),
    onMutate: (commit) => {
      patchCommit(queryClient, commit.id, (c) => ({ ...c, pasteis_count: (c.pasteis_count ?? 0) + 1 }));
      queryClient.setQueryData(['me'], (data: typeof me.data) => (data && data.pasteis_remaining !== null ? { ...data, pasteis_remaining: Math.max(0, data.pasteis_remaining - 1) } : data));
    },
    onSuccess: (updated) => {
      if (updated?.id) {
        patchCommit(queryClient, updated.id, (c) => ({ ...c, pasteis_count: updated.pasteis_count ?? c.pasteis_count }));
      }
    },
    onError: (error, commit) => {
      patchCommit(queryClient, commit.id, (c) => ({ ...c, pasteis_count: Math.max(0, (c.pasteis_count ?? 1) - 1) }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      failed(error);
    },
  });

  function failed(error: unknown) {
    if (error instanceof Unauthenticated) {
      account.signOut().then(() => router.replace('/onboarding'));

      return;
    }

    Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: something went wrong.');
  }

  return useMemo<CommitHandlers>(
    () => ({
      onStar: (commit) => {
        tap();
        star.mutate(commit);
      },
      onVote: (commit, optionId) => {
        tap();
        vote.mutate({ commit, optionId });
      },
      onDelete: (commit) => remove.mutate(commit),
      onPin: (commit) => pin.mutate(commit),
      onCard: (commit) => router.push({ pathname: '/card/[id]', params: { id: commit.id } }),
      onOpen: (commit) => router.push({ pathname: '/commits/[id]', params: { id: commit.id } }),
      onReply: (commit) => router.push({ pathname: '/commits/[id]', params: { id: commit.id, reply: '1' } }),
      onQuote: (commit) => router.push({ pathname: '/compose', params: { quote: commit.id } }),
      onOpenAuthor: (user) => router.push({ pathname: '/users/[username]', params: { username: user.handle } }),
      onReport: (commit) => reportCommit(commit),
      onTranslate: (commit) => translate.mutate(commit),
      onShowOriginal: (commit) => patchCommit(queryClient, commit.id, (c) => ({ ...c, translated: false })),
      onOpenOrg: (handle) => router.push({ pathname: '/orgs/[handle]', params: { handle } }),
      onPastel: (commit) => {
        tap();

        if (pasteisLeft === 0) {
          toast('you ran out of pastéis. wait until tomorrow.');

          return;
        }

        pastel.mutate(commit);
      },
      pasteisLeft,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pasteisLeft],
  );
}
