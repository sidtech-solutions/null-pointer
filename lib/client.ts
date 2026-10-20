import { currentKey } from './device-key';
import { randomHex } from './random';
import { signatureHeaders } from './signer';
import type { Commit, CommitThread, Connection, CurrentUser, Notification, Page, Profile, User } from './types';

export const ProductionUrl = 'https://dev-null.sh';

export function baseUrl(): string {
  return (process.env.EXPO_PUBLIC_DEVNULL_URL || ProductionUrl).replace(/\/+$/, '');
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
  }

  firstError(): string {
    const first = Object.values(this.errors)[0]?.[0];

    return first ?? this.message;
  }

  static couldNotConnect(url: string): ApiError {
    return new ApiError(`fatal: could not connect to ${url}`, 0);
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let json: Record<string, unknown> = {};

    try {
      const parsed: unknown = await response.json();
      json = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      json = {};
    }

    const message = typeof json.message === 'string' && json.message !== '' ? json.message : `fatal: devnull answered ${response.status}.`;
    const code = typeof json.code === 'string' ? json.code : null;
    const errors = json.errors !== null && typeof json.errors === 'object' ? (json.errors as Record<string, string[]>) : {};

    return response.status === 401 ? new Unauthenticated(message, 401, code, errors) : new ApiError(message, response.status, code, errors);
  }
}

/** The server no longer recognises this device key. */
export class Unauthenticated extends ApiError {}

type Query = Record<string, string | null | undefined>;

/** RFC 3986 encoding, matching PHP's http_build_query with PHP_QUERY_RFC3986. */
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase());
}

function split(): { origin: string; prefix: string } {
  const match = baseUrl().match(/^(https?:\/\/[^/]+)(\/.*)?$/);

  return { origin: match?.[1] ?? baseUrl(), prefix: (match?.[2] ?? '').replace(/\/+$/, '') };
}

/** Path as the server sees it (including any base path prefix), plus query string. */
function target(path: string, query: Query): string {
  const pairs = Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');
  const queryString = pairs.map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&');

  return `${split().prefix}/api/v1/${path}${queryString === '' ? '' : `?${queryString}`}`;
}

// Query string and body are built here and sent as the exact bytes that were signed.
async function send(method: string, path: string, query: Query = {}, payload?: unknown): Promise<any> {
  const key = await currentKey();
  const requestTarget = target(path, query);
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...signatureHeaders(key, method, requestTarget, body, Math.floor(Date.now() / 1000), randomHex(16)),
  };

  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;

  try {
    response = await fetch(split().origin + requestTarget, { method, headers, body: payload === undefined ? undefined : body });
  } catch {
    throw ApiError.couldNotConnect(baseUrl());
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  if (response.status === 204) {
    return {};
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function nextCursor<T>(page: Page<T>): string | null {
  return page.meta?.next_cursor ?? page.next_cursor ?? null;
}

export const api = {
  async me(): Promise<CurrentUser> {
    const json = await send('GET', 'me');
    const data = json.data ?? json;

    return {
      user: data.user ?? data,
      unread_notifications_count: Number(json.unread_notifications_count ?? data.unread_notifications_count ?? 0),
      preferred_lane: data.preferred_lane ?? null,
      automatic_lane: typeof data.automatic_lane === 'number' ? data.automatic_lane : null,
      pasteis_mode: data.pasteis_mode === true,
      github_synced_at: typeof data.github_synced_at === 'string' ? data.github_synced_at : null,
      apple_linked: json.apple_linked === true,
      pasteis_remaining: typeof data.pasteis_remaining === 'number' ? data.pasteis_remaining : null,
      pasteis_resets_at: typeof data.pasteis_resets_at === 'string' ? data.pasteis_resets_at : null,
    };
  },

  async syncGitHub(): Promise<void> {
    await send('PUT', 'me/github');
  },

  /** lane: palette index, or null for automatic. color: custom #rrggbb overrides lane. */
  async saveLane(lane: number | null, color: string | null = null): Promise<void> {
    await send('PUT', 'me/lane', {}, color ? { lane: null, color } : { lane });
  },

  async setPasteisMode(enabled: boolean): Promise<void> {
    await send('PUT', 'me/pasteis-mode', {}, { enabled });
  },

  muted(cursor?: string | null): Promise<Page<User>> {
    return send('GET', 'me/muted', { cursor });
  },

  blocked(cursor?: string | null): Promise<Page<User>> {
    return send('GET', 'me/blocked', { cursor });
  },

  async mute(username: string): Promise<void> {
    await send('POST', `users/${encode(username)}/mute`);
  },

  async unmute(username: string): Promise<void> {
    await send('DELETE', `users/${encode(username)}/mute`);
  },

  async block(username: string): Promise<void> {
    await send('POST', `users/${encode(username)}/block`);
  },

  async unblock(username: string): Promise<void> {
    await send('DELETE', `users/${encode(username)}/block`);
  },

  async deleteAccount(): Promise<void> {
    await send('DELETE', 'me');
  },

  async redeemSignIn(code: string, verifier: string): Promise<User> {
    const json = await send('POST', 'devices', {}, { code, code_verifier: verifier });

    return json.data ?? json;
  },

  /** With `since` (id of the newest commit shown), the response includes new_commits_count. */
  log(log: string, cursor?: string | null, since?: string | null): Promise<Page<Commit> & { new_commits_count?: number; suggestions?: Commit[] }> {
    return send('GET', `log/${encode(log)}`, { cursor, since });
  },

  async commit(id: string): Promise<CommitThread> {
    const json = await send('GET', `commits/${encode(id)}`);
    const data = json.data ?? {};
    const commit = data.commit ?? data;
    const ancestors = json.ancestors ?? data.ancestors ?? json.meta?.ancestors ?? [];
    const series = json.series ?? data.series ?? [];

    return { commit, ancestors: Array.isArray(ancestors) ? ancestors : [], series: Array.isArray(series) ? series : [] };
  },

  replies(id: string, cursor?: string | null): Promise<Page<Commit>> {
    return send('GET', `commits/${encode(id)}/replies`, { cursor });
  },

  /** The API accepts parentId or quotedCommitId, not both. */
  async createCommit(body: string, parentId?: string | null, quotedCommitId?: string | null): Promise<Commit> {
    const payload: Record<string, string> = { body };

    if (parentId) {
      payload.parent_id = parentId;
    } else if (quotedCommitId) {
      payload.quoted_commit_id = quotedCommitId;
    }

    return (await send('POST', 'commits', {}, payload)).data;
  },

  starred(cursor?: string | null): Promise<Page<Commit>> {
    return send('GET', 'starred', { cursor });
  },

  /** Reporting the same commit again keeps the first report. */
  async reportCommit(id: string, reason: string, details = ''): Promise<void> {
    await send('POST', `commits/${encode(id)}/reports`, {}, details === '' ? { reason } : { reason, details });
  },

  async givePastel(id: string): Promise<Commit> {
    return (await send('POST', `commits/${encode(id)}/pasteis`)).data;
  },

  async deleteCommit(id: string): Promise<void> {
    await send('DELETE', `commits/${encode(id)}`);
  },

  async profile(username: string): Promise<Profile> {
    const json = await send('GET', `users/${encode(username)}`);
    const data = json.data ?? json;
    const counts = data.counts ?? {};
    const achievements = json.achievements ?? data.achievements;

    return {
      user: data.user ?? data,
      commits_count: Number(data.commits_count ?? counts.commits ?? 0),
      followers_count: Number(data.followers_count ?? counts.followers ?? 0),
      following_count: Number(data.following_count ?? counts.following ?? 0),
      is_following: Boolean(json.is_following ?? data.is_following ?? false),
      follows_you: Boolean(json.follows_you ?? data.follows_you ?? false),
      is_muting: Boolean(json.is_muting ?? data.is_muting ?? false),
      pinned_commit: json.pinned_commit ?? data.pinned_commit ?? null,
      streaks: { longest: Number(json.streaks?.longest ?? data.streaks?.longest ?? 0), current: Number(json.streaks?.current ?? data.streaks?.current ?? 0) },
      achievements: achievements?.rank ? achievements : null,
      activity: (json.activity ?? data.activity)?.buckets ? (json.activity ?? data.activity) : null,
    };
  },

  userCommits(username: string, tab: 'commits' | 'replies', cursor?: string | null): Promise<Page<Commit>> {
    return send('GET', `users/${encode(username)}/commits`, { replies: tab === 'replies' ? '1' : null, cursor });
  },

  connections(username: string, type: 'followers' | 'following', cursor?: string | null): Promise<Page<Connection>> {
    return send('GET', `users/${encode(username)}/${type}`, { cursor });
  },

  async follow(username: string): Promise<void> {
    await send('POST', `users/${encode(username)}/follow`);
  },

  async unfollow(username: string): Promise<void> {
    await send('DELETE', `users/${encode(username)}/follow`);
  },

  /** Listing marks all notifications read server-side. */
  notifications(type: string, cursor?: string | null): Promise<Page<Notification>> {
    return send('GET', 'notifications', { type: type === 'all' ? null : type, cursor });
  },

  notificationGroup(id: string, type: string, cursor?: string | null): Promise<Page<Notification>> {
    return send('GET', `notifications/${encode(id)}/group`, { type: type === 'all' ? null : type, cursor });
  },

  async star(id: string): Promise<Commit> {
    return (await send('POST', `commits/${encode(id)}/star`)).data;
  },

  async unstar(id: string): Promise<Commit> {
    return (await send('DELETE', `commits/${encode(id)}/star`)).data;
  },
};
