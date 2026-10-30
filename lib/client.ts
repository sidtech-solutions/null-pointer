import { utf8 } from './bytes';
import { currentKey } from './device-key';
import { randomHex } from './random';
import { signatureHeaders } from './signer';
import type { Candidate, Commit, CommitPreview, CommitThread, CommitTranslation, Connection, CurrentUser, Device, IceServer, InboxPage, InboxTab, IncomingCall, IssueSuggestion, LinkPreview, Message, MessageReaction, MuteDuration, NewPoll, Notification, Organization, OrgRole, Page, Profile, ReactionUsage, RemotesFrom, ScheduledCommit, SuggestedUser, Thread, User, UserSettings } from './types';

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

/** A file to upload beside a JSON payload: the exact bytes sent, and their SHA-256 (hex) as the server will check it. */
export type Upload = { name: string; type: string; bytes: Uint8Array; sha256: string };

// Expo's fetch builds the multipart body itself from parts that expose bytes(),
// so every part is sent exactly as hashed and signed.
function part(name: string, type: string, bytes: Uint8Array): Blob {
  return { name, type, size: bytes.byteLength, bytes: () => Promise.resolve(bytes) } as unknown as Blob;
}

// Query string and body are built here and sent as the exact bytes that were signed.
// With uploads the request is multipart: the JSON in a `payload` file part, the
// files in `images[]` or the one voice note in `voice`, nothing else, and the signature covers the files' hashes.
async function send(method: string, path: string, query: Query = {}, payload?: unknown, uploads?: Upload[], field: 'images[]' | 'voice' = 'images[]'): Promise<any> {
  const key = await currentKey();
  const requestTarget = target(path, query);
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const nonce = randomHex(16);
  const withUploads = uploads !== undefined && uploads.length > 0;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...signatureHeaders(key, method, requestTarget, body, Math.floor(Date.now() / 1000), nonce, withUploads ? uploads.map((upload) => upload.sha256) : undefined),
  };

  let request: RequestInit = { method, headers };

  if (withUploads) {
    const form = new FormData();
    form.append('payload', part('payload.json', 'application/json', utf8(body)));
    uploads.forEach((upload) => form.append(field, part(upload.name, upload.type, upload.bytes)));
    request = { method, headers, body: form };
  } else if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
    request = { method, headers, body };
  }

  let response: Response;

  try {
    response = await fetch(split().origin + requestTarget, request);
  } catch (exception) {
    if (__DEV__) {
      console.warn(`[devnull] ${method} ${requestTarget} failed:`, exception);
    }

    throw ApiError.couldNotConnect(baseUrl());
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  if (response.status === 204) {
    return {};
  }

  // A maintenance page answers 200 with HTML; that is an error to show, never an empty answer to keep.
  if (!/\bjson\b/i.test(response.headers.get('content-type') ?? '')) {
    throw new ApiError('fatal: dev-null.sh is being updated. Try again in a minute.', response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('fatal: dev-null.sh sent an answer the app could not read.', response.status);
  }
}

export function nextCursor<T>(page: Page<T>): string | null {
  return page.meta?.next_cursor ?? page.next_cursor ?? null;
}

/** Who a conversation is with: one person, by handle, or an org, by id. */
export type RemoteTarget = { kind: 'direct'; handle: string } | { kind: 'org'; id: string };

function remotePath(target: RemoteTarget): string {
  return target.kind === 'direct' ? `remotes/@${encode(target.handle)}` : `remotes/orgs/${encode(target.id)}`;
}

function currentUser(json: any): CurrentUser {
  const data = json.data ?? json;
  const remotes = data.remotes;

  return {
    user: data.user ?? data,
    unread_notifications_count: Number(json.unread_notifications_count ?? data.unread_notifications_count ?? 0),
    preferred_lane: data.preferred_lane ?? null,
    automatic_lane: typeof data.automatic_lane === 'number' ? data.automatic_lane : null,
    pasteis_mode: data.pasteis_mode === true,
    github_synced_at: typeof data.github_synced_at === 'string' ? data.github_synced_at : null,
    terms_version: typeof data.terms_version === 'string' ? data.terms_version : null,
    terms_accepted_at: typeof data.terms_accepted_at === 'string' ? data.terms_accepted_at : null,
    // A server without terms yet has nothing to accept.
    terms_accepted: typeof data.terms_version === 'string' ? data.terms_accepted === true : true,
    apple_linked: json.apple_linked === true,
    pasteis_remaining: typeof data.pasteis_remaining === 'number' ? data.pasteis_remaining : null,
    pasteis_resets_at: typeof data.pasteis_resets_at === 'string' ? data.pasteis_resets_at : null,
    remotes:
      remotes && typeof remotes === 'object'
        ? {
            from: remotes.from === 'everyone' ? 'everyone' : 'following',
            pull_receipts: remotes.pull_receipts === true,
            requests: remotes.requests === true,
            everyone: remotes.everyone === true,
            unread_count: Number(remotes.unread_count ?? 0),
          }
        : null,
  };
}

/** A follower or followee as the API sends it (a user with two flags), or as the app already stores it. */
export function toConnection(raw: Connection | (User & { is_followed?: boolean; follows_you?: boolean })): Connection {
  if ('user' in raw && raw.user && typeof raw.user === 'object') {
    return raw;
  }

  const { is_followed, follows_you, ...user } = raw as User & { is_followed?: boolean; follows_you?: boolean };

  return { user, is_followed: is_followed === true, follows_you: follows_you === true };
}

export const api = {
  async me(): Promise<CurrentUser> {
    return currentUser(await send('GET', 'me'));
  },

  /** Turns Remotes on or off. Off, nobody can push to the user and the inbox is gone until they come back. */
  async setRemotes(enabled: boolean): Promise<CurrentUser> {
    return currentUser(await send('PUT', 'me/remotes', {}, { enabled }));
  },

  async setRemotePreferences(from: RemotesFrom, pullReceipts: boolean): Promise<CurrentUser> {
    return currentUser(await send('PUT', 'me/remote-preferences', {}, { from, pull_receipts: pullReceipts }));
  },

  /** One page of the inbox, newest first; `before` is the id of the last conversation shown. */
  async remotes(tab: InboxTab, term = '', before?: string | null): Promise<InboxPage> {
    const json = await send('GET', 'remotes', { tab: tab === 'open' ? null : tab, q: term, before });

    return { data: Array.isArray(json.data) ? json.data : [], has_more: json.has_more === true, unread_count: Number(json.unread_count ?? 0), requests_count: Number(json.requests_count ?? 0) };
  },

  /**
   * The latest page of a conversation, the page before a message, or everything
   * after one plus the reactions changed since a version, as a poll asks for it.
   */
  async thread(target: RemoteTarget, options: { after?: number | null; before?: number | null; reactionsAfter?: number | null } = {}): Promise<Thread> {
    const json = await send('GET', `${remotePath(target)}/messages`, {
      after: options.after === null || options.after === undefined ? null : String(options.after),
      before: options.before === null || options.before === undefined ? null : String(options.before),
      reactions_after: options.reactionsAfter === null || options.reactionsAfter === undefined ? null : String(options.reactionsAfter),
    });
    const data = json.data ?? json;
    const base = {
      messages: Array.isArray(data.messages) ? data.messages : [],
      has_older: data.has_older === true,
      reactions_version: Number(data.reactions_version ?? 0),
      reaction_changes: Array.isArray(data.reaction_changes) ? data.reaction_changes : [],
      read_through_id: Number(data.read_through_id ?? 0),
      is_archived: data.is_archived === true,
      pinned_at: typeof data.pinned_at === 'string' ? data.pinned_at : null,
      muted_until_at: typeof data.muted_until_at === 'string' ? data.muted_until_at : null,
      access: typeof data.access === 'string' ? data.access : 'open',
    };

    if (target.kind === 'org') {
      return { ...base, kind: 'org', org: data.org ?? { id: target.id, name: null }, members: Array.isArray(data.members) ? data.members : [], typing: Array.isArray(data.typing) ? data.typing : [], role: data.role ?? null, pinned: Array.isArray(data.pinned) ? data.pinned : null };
    }

    return { ...base, kind: 'direct', partner: data.partner, partner_read_through_id: Number(data.partner_read_through_id ?? 0), partner_read_at: data.partner_read_at ?? null, partner_typing: data.partner_typing === true };
  },

  /** Sending the same clientId again, as a retry does, answers with the message already created. */
  /** A voice note goes alone: no body and no images, the WAV in a `voice` part and its bars beside it. */
  async sendMessage(target: RemoteTarget, message: { clientId: string; body: string; replyToId?: number | null; images?: Upload[]; descriptions?: string[]; voice?: { upload: Upload; waveform: number[] } | null }): Promise<Message> {
    const payload: Record<string, unknown> = message.voice ? { client_id: message.clientId, voice_waveform: message.voice.waveform } : { body: message.body, client_id: message.clientId };

    if (message.replyToId) {
      payload.reply_to_id = message.replyToId;
    }

    if (message.images && message.images.length > 0 && message.descriptions?.some((description) => description !== '')) {
      payload.image_descriptions = message.images.map((_, index) => message.descriptions?.[index] || null);
    }

    const json = await send('POST', `${remotePath(target)}/messages`, {}, payload, message.voice ? [message.voice.upload] : message.images, message.voice ? 'voice' : 'images[]');

    return json.data ?? json;
  },

  /** Pulls the conversation through a message. It only ever moves forward. */
  async markRemoteRead(target: RemoteTarget, through: number): Promise<void> {
    await send('PUT', `${remotePath(target)}/read`, {}, { through });
  },

  async remoteTyping(target: RemoteTarget): Promise<void> {
    await send('PUT', `${remotePath(target)}/typing`);
  },

  /** Stashing is for this user only; the conversation pops back into Open when anyone writes. */
  async stashRemote(target: RemoteTarget, stashed: boolean): Promise<void> {
    await send(stashed ? 'POST' : 'DELETE', `${remotePath(target)}/archive`);
  },

  async mergeRequest(username: string): Promise<void> {
    await send('POST', `remotes/@${encode(username)}/merge`);
  },

  /** Dropping is silent: the sender's request keeps waiting on their side. */
  async dropRequest(username: string): Promise<void> {
    await send('POST', `remotes/@${encode(username)}/drop`);
  },

  /** A message's link card, asked for again while the server is still fetching it. */
  async messageLinkPreview(messageId: number): Promise<LinkPreview | null> {
    return (await send('GET', `remotes/messages/${encode(String(messageId))}/link-preview`)).link_preview ?? null;
  },

  async reactionUsage(): Promise<ReactionUsage[]> {
    const json = await send('GET', 'remotes/reactions');

    return Array.isArray(json.usage) ? json.usage : [];
  },

  /** Answers with the message's reactions in the order they were left. */
  async react(messageId: number, emoji: string, on: boolean): Promise<MessageReaction[]> {
    const json = await send(on ? 'POST' : 'DELETE', `remotes/messages/${encode(String(messageId))}/reactions`, {}, { emoji });

    return Array.isArray(json.reactions) ? json.reactions : [];
  },

  /** People by name or handle, as the web's search finds them, with whether each follows the user and is followed. Mutes and blocks apply. */
  async searchUsers(term: string): Promise<SuggestedUser[]> {
    const query = term.trim().slice(0, 100);

    if (query === '') {
      return [];
    }

    const json = await send('GET', 'search/users', { q: query });

    return Array.isArray(json.data) ? json.data.filter((user: SuggestedUser) => user && typeof user.handle === 'string') : [];
  },

  /** Commits by meaning: three characters at least, up to 100 answers, 15 searches a minute. Full commits, as the log sends them. */
  async searchCommits(term: string, limit = 20): Promise<Commit[]> {
    const query = term.trim().slice(0, 100);

    if (Array.from(query).length < 3) {
      return [];
    }

    const json = await send('GET', 'search/commits', { q: query, limit: String(limit) });

    return Array.isArray(json.data) ? json.data : [];
  },

  /**
   * People to mention, as the web's composer suggests them: with no term, the
   * people the user follows; replies and quotes put the thread's people first.
   */
  async mentionSuggestions(term: string, context: { reply?: string | null; quote?: string | null } = {}): Promise<User[]> {
    const json = await send('GET', 'search/mentions', { q: term, reply: context.reply ?? null, quote: context.quote ?? null });

    return Array.isArray(json.users) ? json.users : Array.isArray(json.data) ? json.data : [];
  },

  /** People to push to or add to an org, each with the reason they can't be picked, if any. */
  async remoteCandidates(term: string, options: { forOrg?: boolean; org?: string | null } = {}): Promise<Candidate[]> {
    const json = await send('GET', 'remotes/candidates', { q: term, org: options.org ?? null, for: options.forOrg ? 'org' : null });

    return Array.isArray(json.candidates) ? json.candidates : [];
  },

  /** Starts an org the user maintains, with everyone named as contributors. Answers with its id. */
  async createOrg(name: string, members: string[]): Promise<string> {
    const json = await send('POST', 'remotes/orgs', {}, { name: name.trim() === '' ? null : name.trim(), members });

    return String(json.org?.id ?? json.data?.org?.id ?? '');
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

  /** Registers this phone's key with the code dev-null.sh sent back. Answers as `me` does. */
  async redeemSignIn(code: string, verifier: string): Promise<CurrentUser> {
    return currentUser(await send('POST', 'devices', {}, { code, code_verifier: verifier }));
  },

  /** Records that the person accepted the terms and privacy policy the app showed them, by the version `me` named. */
  async acceptTerms(version: string): Promise<CurrentUser> {
    return currentUser(await send('PUT', 'me/terms', {}, { version }));
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

  /**
   * The API accepts parentId or quotedCommitId, not both. A poll goes only on a
   * top-level commit without images; images may go on anything. The body may be
   * empty when there are images.
   */
  async createCommit(body: string, options: { parentId?: string | null; quotedCommitId?: string | null; images?: Upload[]; descriptions?: string[]; poll?: NewPoll | null } = {}): Promise<Commit> {
    const payload: Record<string, unknown> = { body };

    if (options.parentId) {
      payload.parent_id = options.parentId;
    } else if (options.quotedCommitId) {
      payload.quoted_commit_id = options.quotedCommitId;
    }

    if (options.poll) {
      payload.poll = { options: options.poll.options, duration: options.poll.duration };
    }

    if (options.images && options.images.length > 0 && options.descriptions?.some((description) => description !== '')) {
      payload.image_descriptions = options.images.map((_, index) => options.descriptions?.[index] || null);
    }

    return (await send('POST', 'commits', {}, payload, options.images)).data;
  },

  /** Votes are final. Answers with the commit, its poll now showing results. */
  async votePoll(commitId: string, optionId: string): Promise<Commit> {
    return (await send('POST', `commits/${encode(commitId)}/poll/votes`, {}, { option: optionId })).data;
  },

  /** A draft as the commit it would become: the body as it would be kept, its segments, and its mentions. Nothing is stored. */
  async previewCommit(body: string): Promise<CommitPreview> {
    return (await send('POST', 'commits/preview', {}, { body })).data;
  },

  /** Pins one of the user's own top-level commits to their profile, replacing any pin before it. Answers with the commit. */
  async pin(id: string): Promise<Commit> {
    return (await send('PUT', `commits/${encode(id)}/pin`)).data;
  },

  async unpin(id: string): Promise<Commit> {
    return (await send('DELETE', `commits/${encode(id)}/pin`)).data;
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

  /** The API lists plain users with `is_followed` and `follows_you` on each; the app keeps the user apart from the flags. */
  async connections(username: string, type: 'followers' | 'following', cursor?: string | null): Promise<Page<Connection>> {
    const page: Page<Connection | (User & { is_followed?: boolean; follows_you?: boolean })> = await send('GET', `users/${encode(username)}/${type}`, { cursor });

    return { ...page, data: (page.data ?? []).map(toConnection) };
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
  /**
   * Who to follow: the day's picks, a few per round, each with how many people the user follows follow them.
   * Beside a profile or a commit, that developer's people or the thread's come first.
   */
  async suggestedUsers(round = 0, context: { handle?: string | null; commitId?: string | null } = {}): Promise<SuggestedUser[]> {
    const json = await send('GET', 'me/suggested-users', { round: String(round), handle: context.handle ?? null, commit_id: context.commitId ?? null });

    return Array.isArray(json.data) ? json.data : [];
  },

  /** Not interested: the person is never suggested again. */
  async dismissSuggestion(username: string): Promise<void> {
    await send('POST', `users/${encode(username)}/dismiss`);
  },

  /** Undoes deleting one of the user's commits within the 30 s window; answers with the commit as it was. */
  async restoreCommit(id: string): Promise<Commit> {
    return (await send('POST', `commits/${encode(id)}/restoration`)).data;
  },

  /** Commits near this one in meaning, as the web lists under a thread. */
  async relatedCommits(id: string): Promise<Commit[]> {
    const json = await send('GET', `commits/${encode(id)}/related`);

    return Array.isArray(json.data) ? json.data : [];
  },

  /** Translates a commit into a language; the server keeps the translation, so asking again is free. 503 while the provider is down. */
  async translateCommit(id: string, language: string): Promise<CommitTranslation | null> {
    const json = await send('POST', `commits/${encode(id)}/translation`, {}, { language });

    return json.translation ?? null;
  },

  async settings(): Promise<UserSettings> {
    const data = (await send('GET', 'me/settings')).data ?? {};

    return {
      timezone: typeof data.timezone === 'string' ? data.timezone : null,
      show_local_time: data.show_local_time === true,
      translation_language: typeof data.translation_language === 'string' ? data.translation_language : null,
      automatic_translation: data.automatic_translation !== false,
      translation_languages: Array.isArray(data.translation_languages) ? data.translation_languages : [],
      is_admin: data.is_admin === true,
    };
  },

  /** timezone: an IANA name, or null to forget it; showLocalTime: whether the profile shows the user's local time. */
  async saveTimezone(timezone: string | null, showLocalTime: boolean): Promise<void> {
    await send('PUT', 'me/timezone', {}, { timezone, show_local_time: showLocalTime });
  },

  async setAutomaticTranslation(enabled: boolean): Promise<void> {
    await send('PUT', 'me/automatic-translation', {}, { enabled });
  },

  /** language: a code from settings, or null to follow the phone's language. */
  async setTranslationLanguage(language: string | null): Promise<void> {
    await send('PUT', 'me/translation-language', {}, { translation_language: language });
  },

  /** The keys approved to sign as the user, newest approval first. */
  async devices(): Promise<Device[]> {
    const json = await send('GET', 'me/devices');

    return Array.isArray(json.data) ? json.data : [];
  },

  /** Revoking the key this phone signs with signs the app out on the server's side. */
  async revokeDevice(id: string): Promise<void> {
    await send('DELETE', `me/devices/${encode(id)}`);
  },

  async organization(handle: string): Promise<Organization> {
    return (await send('GET', `organizations/${encode(handle)}`)).data;
  },

  organizationMentions(handle: string, cursor?: string | null): Promise<Page<Commit>> {
    return send('GET', `organizations/${encode(handle)}/mentions`, { cursor });
  },

  /** The queue, page by page: waiting commits first by date, then the ones already submitted. */
  async scheduledCommits(page = 1): Promise<{ data: ScheduledCommit[]; next: number | null }> {
    const json = await send('GET', 'scheduled-commits', { page: page > 1 ? String(page) : null });
    const current = Number(json.meta?.current_page ?? page);
    const last = Number(json.meta?.last_page ?? current);

    return { data: Array.isArray(json.data) ? json.data : [], next: current < last ? current + 1 : null };
  },

  /**
   * Queues a top-level commit for a moment up to 30 days away, `scheduledAt` as ISO 8601 with its offset.
   * Images and a poll go as on a commit; up to 10 can wait at once.
   */
  async scheduleCommit(body: string, scheduledAt: string, options: { images?: Upload[]; descriptions?: string[]; poll?: NewPoll | null } = {}): Promise<ScheduledCommit> {
    const payload: Record<string, unknown> = { body, scheduled_at: scheduledAt };

    if (options.poll) {
      payload.poll = { options: options.poll.options, duration: options.poll.duration };
    }

    if (options.images && options.images.length > 0 && options.descriptions?.some((description) => description !== '')) {
      payload.image_descriptions = options.images.map((_, index) => options.descriptions?.[index] || null);
    }

    return (await send('POST', 'scheduled-commits', {}, payload, options.images)).data;
  },

  /** 409 when it was already submitted or canceled. */
  async cancelScheduledCommit(id: string): Promise<void> {
    await send('DELETE', `scheduled-commits/${encode(id)}`);
  },

  /** Submits a waiting commit now instead of at its time. 409 when it already went. */
  async submitScheduledCommit(id: string): Promise<ScheduledCommit> {
    return (await send('POST', `scheduled-commits/${encode(id)}/submission`)).data;
  },

  /** The /dev/null issue with that number, or null when there is none. */
  async issueSuggestion(number: string): Promise<IssueSuggestion | null> {
    const json = await send('GET', 'search/issues', { q: number });

    return json.issue && typeof json.issue.number === 'number' ? json.issue : null;
  },

  /** Maintainers only, up to the org's limit. Answers with every pinned message, newest pin first. */
  async pinMessage(messageId: number, pinned: boolean): Promise<{ pinned: Message[]; reactions_version: number }> {
    const json = await send(pinned ? 'PUT' : 'DELETE', `remotes/messages/${encode(String(messageId))}/pin`);

    return { pinned: Array.isArray(json.pinned) ? json.pinned : [], reactions_version: Number(json.reactions_version ?? 0) };
  },

  /** Keeps a conversation at the top of the inbox, for this user only. Answers with when it was pinned. */
  async pinRemote(target: RemoteTarget, pinned: boolean): Promise<string | null> {
    const json = await send('PUT', `${remotePath(target)}/pin`, {}, { pinned });

    return typeof json.pinned_at === 'string' ? json.pinned_at : null;
  },

  /** Quiets a conversation's badge and pushes for a while; `off` ends it. Answers with when the mute ends, null for never or none. */
  async muteRemote(target: RemoteTarget, duration: MuteDuration): Promise<string | null> {
    const json = await send('PUT', `${remotePath(target)}/mute`, {}, { duration });

    return typeof json.muted_until_at === 'string' ? json.muted_until_at : null;
  },

  /** A nudge with nothing to say: an event in the thread, and a push for the others. */
  // Calls: the two short messages the phones need to find each other, held
  // by dev-null.sh only while the call rings, and relay credentials for one
  // call. The routes mirror the web's; they answer 404 until the API has them.
  async incomingCall(): Promise<IncomingCall | null> {
    const json = await send('GET', 'remotes/call');

    return json.call ?? null;
  },

  async outgoingCall(handle: string): Promise<{ answer: string | null } | null> {
    const json = await send('GET', `remotes/@${encode(handle)}/call`);

    return json.call ?? null;
  },

  async startCall(handle: string, sdp: string): Promise<void> {
    await send('POST', `remotes/@${encode(handle)}/call`, {}, { sdp });
  },

  async answerCall(handle: string, sdp: string): Promise<void> {
    await send('PUT', `remotes/@${encode(handle)}/call`, {}, { sdp });
  },

  async endCall(handle: string, failed = false): Promise<void> {
    await send('DELETE', `remotes/@${encode(handle)}/call`, {}, { failed });
  },

  async callIceServers(handle: string): Promise<{ iceServers: IceServer[]; relayOnly: boolean }> {
    const json = await send('GET', `remotes/@${encode(handle)}/call/ice-servers`);

    return { iceServers: json.ice_servers ?? [], relayOnly: json.is_relay_only !== false };
  },

  async pingRemote(target: RemoteTarget): Promise<Message> {
    const json = await send('POST', `${remotePath(target)}/ping`);

    return json.data ?? json;
  },

  /** Maintainers only. With the history, the new people see everything; without it, only what comes after. */
  async addOrgMembers(org: string, members: string[], shareHistory: boolean): Promise<void> {
    await send('POST', `remotes/orgs/${encode(org)}/members`, {}, { members, share_history: shareHistory });
  },

  async setOrgRole(org: string, username: string, role: OrgRole): Promise<void> {
    await send('PUT', `remotes/orgs/${encode(org)}/members/${encode(username)}`, {}, { role });
  },

  /** Maintainers remove anyone; anyone removes themself, which is leaving. */
  async removeOrgMember(org: string, username: string): Promise<void> {
    await send('DELETE', `remotes/orgs/${encode(org)}/members/${encode(username)}`);
  },

  /** Maintainers only; an empty name clears it, and the org goes by its people again. */
  async renameOrg(org: string, name: string): Promise<void> {
    await send('PUT', `remotes/orgs/${encode(org)}`, {}, { name: name.trim() === '' ? null : name.trim() });
  },
};
