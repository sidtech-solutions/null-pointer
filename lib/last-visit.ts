import { storage } from './storage';
import type { Commit } from './types';

/**
 * Newest commit time seen per log, per user. The marker is skipped on a first
 * visit, when nothing is new, or when the only new commits are the user's own.
 */
function key(userId: string | number, log: string): string {
  return `devnull.last-visit.${userId}.${log}`;
}

export function seenAt(userId: string | number, log: string): string | null {
  return storage.getString(key(userId, log)) ?? null;
}

export function rememberVisit(userId: string | number, log: string, commits: Commit[]): void {
  const newest = commits[0]?.created_at;

  if (newest) {
    storage.set(key(userId, log), newest);
  }
}

export function firstSeenId(commits: Commit[], seen: string | null, userId: string | number | undefined): string | null {
  if (seen === null || userId === undefined) {
    return null;
  }

  const seenTime = Date.parse(seen);

  if (Number.isNaN(seenTime)) {
    return null;
  }

  for (let index = 0; index < commits.length; index++) {
    const commit = commits[index];
    const created = commit.created_at ? Date.parse(commit.created_at) : NaN;

    if (Number.isNaN(created) || created > seenTime) {
      continue;
    }

    return commits.slice(0, index).some((newer) => String(newer.author?.id) !== String(userId)) ? commit.id : null;
  }

  return null;
}
