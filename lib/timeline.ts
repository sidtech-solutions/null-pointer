import { dayKey, dayLabel } from './display';
import type { Commit } from './types';

/**
 * A run is consecutive commits by one author: avatar on the first, lane dot on
 * the rest. A day marker breaks a run. Commit pages draw one rail from the
 * oldest ancestor down.
 */
export type CommitRowSpec = {
  type: 'commit';
  key: string;
  commit: Commit;
  continuesRun: boolean;
  continuesNext: boolean;
};

export type DayRowSpec = { type: 'day'; key: string; label: string };

export type LastVisitRowSpec = { type: 'last-visit'; key: string };

export type FeedRow = CommitRowSpec | DayRowSpec | LastVisitRowSpec;

export function isDeleted(commit: Commit): boolean {
  return typeof commit.deleted_at === 'string';
}

export function continuesRun(previous: Commit | null, commit: Commit): boolean {
  return previous !== null && !isDeleted(previous) && !isDeleted(commit) && String(previous.author?.id) === String(commit.author?.id);
}

export function feedRows(commits: Commit[], now: number, dayMarkers = true, firstSeenId: string | null = null): FeedRow[] {
  const rows: FeedRow[] = [];
  let previous: Commit | null = null;

  for (const commit of commits) {
    const isFirstSeen = firstSeenId !== null && commit.id === firstSeenId;
    const startsDay = dayMarkers && startsNewDay(previous, commit);

    if (isFirstSeen) {
      rows.push({ type: 'last-visit', key: 'last-visit' });
    }

    if (startsDay && commit.created_at) {
      const label = dayLabel(commit.created_at, now);
      rows.push({ type: 'day', key: `day-${label}-${commit.id}`, label });
    }

    rows.push({ type: 'commit', key: `commit-${commit.id}`, commit, continuesRun: !startsDay && !isFirstSeen && continuesRun(previous, commit), continuesNext: false });
    previous = commit;
  }

  return joinRuns(rows);
}

export function threadRows(commits: Commit[]): CommitRowSpec[] {
  const rows: CommitRowSpec[] = [];
  let previous: Commit | null = null;

  for (const commit of commits) {
    rows.push({ type: 'commit', key: `commit-${commit.id}`, commit, continuesRun: continuesRun(previous, commit), continuesNext: false });
    previous = commit;
  }

  return joinRuns(rows) as CommitRowSpec[];
}

function joinRuns(rows: FeedRow[]): FeedRow[] {
  return rows.map((row, index) => {
    const next = rows[index + 1];

    return row.type === 'commit' && next?.type === 'commit' && next.continuesRun ? { ...row, continuesNext: true } : row;
  });
}

function startsNewDay(previous: Commit | null, commit: Commit): boolean {
  if (previous === null) {
    return true;
  }

  if (!previous.created_at || !commit.created_at) {
    return false;
  }

  return dayKey(previous.created_at) !== dayKey(commit.created_at);
}
