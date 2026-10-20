import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Commit, CommitThread, Page, Profile } from './types';

// Patches every cached copy of a commit: logs, reply previews, commit pages, threads.
export function patchCommit(queryClient: QueryClient, id: string, change: (commit: Commit) => Commit): void {
  const patch = (commit: Commit): Commit => {
    const patched = commit.id === id ? change(commit) : commit;
    const preview = patched.reply_preview?.data;
    const quoted = patched.quoted_commit;

    return {
      ...patched,
      ...(preview ? { reply_preview: { ...patched.reply_preview, data: preview.map(patch) } } : {}),
      ...(quoted ? { quoted_commit: patch(quoted) } : {}),
    };
  };

  queryClient.setQueriesData<InfiniteData<Page<Commit>>>({ predicate: (query) => query.queryKey[0] === 'log' || query.queryKey[0] === 'replies' || query.queryKey[0] === 'user-commits' }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map(patch) })) } : data,
  );

  queryClient.setQueriesData<Page<Commit>>({ queryKey: ['thread'] }, (page) => (page ? { ...page, data: page.data.map(patch) } : page));

  queryClient.setQueriesData<CommitThread>({ queryKey: ['commit'] }, (thread) =>
    thread ? { commit: patch(thread.commit), ancestors: thread.ancestors.map(patch), series: thread.series.map(patch) } : thread,
  );

  queryClient.setQueriesData<Profile>({ queryKey: ['profile'] }, (profile) => (profile?.pinned_commit ? { ...profile, pinned_commit: patch(profile.pinned_commit) } : profile));
}

export function removeCommit(queryClient: QueryClient, id: string): void {
  queryClient.setQueriesData<InfiniteData<Page<Commit>>>({ predicate: (query) => query.queryKey[0] === 'log' || query.queryKey[0] === 'replies' || query.queryKey[0] === 'user-commits' }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((commit) => commit.id !== id) })) } : data,
  );
  queryClient.setQueriesData<Page<Commit>>({ queryKey: ['thread'] }, (page) => (page ? { ...page, data: page.data.filter((commit) => commit.id !== id) } : page));
}

export function prependCommit(queryClient: QueryClient, commit: Commit): void {
  for (const log of ['following', 'latest']) {
    queryClient.setQueryData<InfiniteData<Page<Commit>>>(['log', log], (data) =>
      data && data.pages.length > 0 ? { ...data, pages: [{ ...data.pages[0], data: [commit, ...data.pages[0].data] }, ...data.pages.slice(1)] } : data,
    );
  }
}

export function findCachedCommit(queryClient: QueryClient, id: string): Commit | null {
  const thread = queryClient.getQueryData<CommitThread>(['commit', id]);

  if (thread) {
    return thread.commit;
  }

  for (const query of queryClient.getQueryCache().findAll({ predicate: (query) => query.queryKey[0] === 'log' || query.queryKey[0] === 'replies' })) {
    const data = query.state.data as InfiniteData<Page<Commit>> | undefined;

    for (const page of data?.pages ?? []) {
      for (const commit of page.data) {
        if (commit.id === id) {
          return commit;
        }

        const reply = commit.reply_preview?.data.find((candidate) => candidate.id === id);

        if (reply) {
          return reply;
        }
      }
    }
  }

  return null;
}
