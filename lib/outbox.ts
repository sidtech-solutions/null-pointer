import type { QueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';

import { toUploads } from '@/components/composer';

import { api, ApiError } from './client';
import { prependCommit } from './commit-cache';
import type { Attachment } from './images';
import { randomHex } from './random';
import { storage } from './storage';
import type { NewPoll } from './types';

/**
 * Commits written while offline, or that could not reach devnull, kept on the
 * phone until they can be pushed. Each is sent once, in order; one that devnull
 * refuses (too long, rules not accepted) stays here with the reason, so the
 * user can drop it or fix it, and never blocks the ones after it.
 */
export type OutboxItem = {
  id: string;
  body: string;
  parentId: string | null;
  quotedCommitId: string | null;
  poll: NewPoll | null;
  images: Attachment[];
  createdAt: string;
  attempts: number;
  /** devnull's reason the last time, when it answered at all; null while it is only waiting for a connection. */
  error: string | null;
};

const Key = 'devnull.outbox';
const listeners = new Set<() => void>();
let pushing = false;

function read(): OutboxItem[] {
  try {
    const raw = storage.getString(Key);

    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  if (items.length === 0) {
    storage.remove(Key);
  } else {
    storage.set(Key, JSON.stringify(items));
  }

  listeners.forEach((listener) => listener());
}

export function outbox(): OutboxItem[] {
  return read();
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** Whether a failure means devnull could not be reached at all, as opposed to answering no. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function folder(): Directory {
  const directory = new Directory(Paths.document, 'outbox');

  directory.create({ intermediates: true, idempotent: true });

  return directory;
}

/** Keeps the draft and copies its images somewhere the system will not clean up before they are sent. */
export async function enqueue(draft: { body: string; parentId?: string | null; quotedCommitId?: string | null; poll?: NewPoll | null; images: Attachment[] }): Promise<OutboxItem> {
  const id = randomHex(8);
  const kept: Attachment[] = [];

  for (const image of draft.images) {
    try {
      const copy = new File(folder(), `${id}-${image.id}-${image.name}`);
      await new File(image.uri).copy(copy);
      kept.push({ ...image, uri: copy.uri });
    } catch {
      // An image that cannot be kept is left out rather than losing the words.
    }
  }

  const item: OutboxItem = {
    id,
    body: draft.body,
    parentId: draft.parentId ?? null,
    quotedCommitId: draft.quotedCommitId ?? null,
    poll: draft.poll ?? null,
    images: kept,
    createdAt: new Date().toISOString(),
    attempts: 0,
    error: null,
  };

  write([...read(), item]);

  return item;
}

function forgetFiles(item: OutboxItem): void {
  for (const image of item.images) {
    try {
      const file = new File(image.uri);

      if (file.exists) {
        file.delete();
      }
    } catch {
      // Already gone.
    }
  }
}

export function remove(id: string): void {
  const items = read();
  const item = items.find((candidate) => candidate.id === id);

  if (item) {
    forgetFiles(item);
  }

  write(items.filter((candidate) => candidate.id !== id));
}

/** Clears a refusal so the next push tries the item again. */
export function retry(id: string): void {
  write(read().map((item) => (item.id === id ? { ...item, error: null } : item)));
}

/**
 * Pushes what is waiting, oldest first. Stops at the first item devnull
 * cannot be reached for, and skips items it has refused until they are
 * retried. Answers how many were committed.
 */
export async function push(queryClient: QueryClient): Promise<number> {
  if (pushing) {
    return 0;
  }

  pushing = true;
  let committed = 0;

  try {
    for (const item of read()) {
      if (item.error !== null) {
        continue;
      }

      try {
        const { uploads, descriptions } = await toUploads(item.images);
        const created = await api.createCommit(item.body, { parentId: item.parentId, quotedCommitId: item.quotedCommitId, images: uploads, descriptions, poll: item.poll });

        forgetFiles(item);
        write(read().filter((candidate) => candidate.id !== item.id));
        committed += 1;

        if (item.parentId) {
          queryClient.invalidateQueries({ queryKey: ['replies', item.parentId] });
        } else {
          prependCommit(queryClient, created);
        }
      } catch (error) {
        if (isOffline(error)) {
          write(read().map((candidate) => (candidate.id === item.id ? { ...candidate, attempts: candidate.attempts + 1 } : candidate)));

          break;
        }

        const reason = error instanceof ApiError ? error.firstError() : error instanceof Error && error.message ? error.message : 'fatal: could not commit.';

        write(read().map((candidate) => (candidate.id === item.id ? { ...candidate, attempts: candidate.attempts + 1, error: reason } : candidate)));
      }
    }

    if (committed > 0) {
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  } finally {
    pushing = false;
  }

  return committed;
}
