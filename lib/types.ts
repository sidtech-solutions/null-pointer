export type Lane = number | string | null;

/** The stream a user is on right now, as the server found it on their profile; gone once it ends. */
export type LiveStream = { platform: 'youtube' | 'twitch' | string; url: string; thumbnail_url: string; ends_at: string };

export type User = {
  id: string | number;
  handle: string;
  name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  lane: Lane;
  company?: string | null;
  location?: string | null;
  website?: string | null;
  github_url?: string | null;
  html_url?: string | null;
  created_at?: string | null;
  live?: LiveStream | null;
  followers_count?: number;
  following_count?: number;
  commits_count?: number;
};

/** Someone the server suggests following: a user with why, and whether they already follow the reader. */
export type SuggestedUser = User & { is_followed?: boolean; follows_you?: boolean; followed_by_following_count?: number };

/** An organization on GitHub that commits mention, as `organizations/{handle}` describes it. */
export type Organization = { handle: string; name: string | null; avatar_url: string | null; bio: string | null; location: string | null; website: string | null; github_url: string; html_url: string };

/** A key approved to sign as the user, as the web's Devices page lists them. */
export type Device = { id: string; name: string; fingerprint: string; approved_at: string; last_used_at: string | null };

export type TranslationLanguage = { code: string; name: string; native_name: string };

/** What the web's settings show only the user: time zone, translation, and whether they are an admin. */
export type UserSettings = { timezone: string | null; show_local_time: boolean; translation_language: string | null; automatic_translation: boolean; translation_languages: TranslationLanguage[]; is_admin: boolean };

/** A commit in another language, as `POST commits/{id}/translation` answers: null segments while the translation is still being made. */
export type CommitTranslation = { language: string; source_language: string | null; source_name: string | null; available: boolean; translated: { body_segments?: BodySegment[] | null; preview_segments?: BodySegment[] | null } | null };

/** A /dev/null GitHub issue the composer can reference by number. */
export type IssueSuggestion = { number: number; title: string; url: string };

export type ScheduledStatus = 'scheduled' | 'pending' | 'approved' | 'rejected' | 'deleted';

/** A commit waiting in the user's queue, or one already submitted and what became of it. */
export type ScheduledCommit = { id: string; body: string | null; body_segments?: BodySegment[] | null; preview_segments?: BodySegment[] | null; poll_options: string[] | null; image_count: number; scheduled_at: string; submitted_at: string | null; status: ScheduledStatus };

export type ReplyPreview = {
  data: Commit[];
  next_cursor?: string | null;
};

export type CommitImage = { id?: string; url: string; width?: number; height?: number; description?: string | null };

export type LinkPreview = { url: string; title?: string | null; description?: string | null; image_url?: string | null; site_name?: string | null; /** The server has not fetched the page yet; ask again for the card. */ is_pending?: boolean };

/** A commit as the web's public commit search answers it: the model with its author under `user`, not a CommitResource. */
export type CommitHit = { id: string; body: string; created_at: string | null; replies_count?: number; stars_count?: number; user?: Pick<User, 'id' | 'handle' | 'name' | 'avatar_url' | 'lane'> | null };

/** A draft as the server would keep it, from `POST commits/preview`. */
export type CommitPreview = { body: string; body_segments?: BodySegment[] | null; preview_segments?: BodySegment[] | null; mentions?: Mention[] };

export type BodySegment = { type: 'text'; text: string } | { type: 'code'; code: string } | { type: 'block'; language?: string | null; /** The code highlighted by the server, as tempest/highlight HTML. */ html?: string; code?: string };

export type Mention = { handle: string; offset?: number; length?: number; kind?: 'user' | 'organization' };

export type PollOption = { id: string; label: string; votes_count?: number | null; voted?: boolean; percentage?: number | null };

export type Poll = { id: string; options: PollOption[]; closes_at?: string | null; is_closed?: boolean; has_voted?: boolean; votes_count?: number | null };

export type Commit = {
  id: string;
  body: string;
  status: string;
  author: User;
  created_at: string | null;
  parent_id: string | null;
  replies_count: number;
  stars_count: number;
  starred: boolean;
  short_hash?: string;
  html_url?: string | null;
  deleted_at?: string | null;
  parent?: Commit | null;
  quoted_commit_id?: string | null;
  quoted_commit?: Commit | null;
  reply_preview?: ReplyPreview | null;
  images?: CommitImage[];
  link_preview?: LinkPreview | null;
  is_pinned?: boolean;
  body_segments?: BodySegment[] | null;
  preview_segments?: BodySegment[] | null;
  mentions?: Mention[];
  series_id?: string | null;
  series_position?: number | null;
  series_size?: number | null;
  poll?: Poll | null;
  pasteis_count?: number;
  /** App only: the translation fetched for this commit, and whether it is the one showing. */
  translation?: CommitTranslation | null;
  translated?: boolean;
};

export type Page<T> = {
  data: T[];
  meta?: { next_cursor?: string | null };
  next_cursor?: string | null;
};

export type CommitThread = {
  commit: Commit;
  /** Oldest first. */
  ancestors: Commit[];
  series: Commit[];
};

export type Streaks = { longest: number; current: number };

export type Badge = { id: string; name: string; description?: string; icon?: string; unlocked?: boolean; progress?: number; target?: number };

export type Rank = { rank: string; level: number; min_xp: number; description?: string; achieved?: boolean };

export type Achievements = { level: number; rank: string; xp?: number; next_level_xp?: number | null; level_progress?: number; ranks?: Rank[]; badges?: Badge[] };

export type ActivityScale = 'day' | 'week' | 'month' | 'year';

export type Activity = { scale: ActivityScale; buckets: { date: string; count: number }[] };

export type Profile = {
  user: User;
  commits_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  follows_you: boolean;
  is_muting: boolean;
  pinned_commit: Commit | null;
  streaks: Streaks;
  achievements: Achievements | null;
  activity: Activity | null;
};

export type Connection = { user: User; is_followed: boolean; follows_you: boolean };

export type NotificationType = 'replied' | 'mentioned' | 'starred' | 'quoted' | 'followed' | 'approved' | 'rejected' | string;

export type Notification = {
  id: string;
  type: NotificationType;
  actor: User & { is_followed?: boolean };
  actors?: User[];
  actors_count?: number;
  created_at: string | null;
  read_at?: string | null;
  unread_count?: number;
  commit?: (Partial<Commit> & { id: string }) | null;
  commit_id?: string | null;
  reason?: string | null;
  group_id?: string;
  event_count?: number;
};

export type CurrentUser = {
  user: User;
  unread_notifications_count: number;
  preferred_lane: Lane;
  automatic_lane: number | null;
  pasteis_mode: boolean;
  github_synced_at: string | null;
  /** The terms and privacy policy in force, as the moment they took effect; null if the server predates them. */
  terms_version: string | null;
  terms_accepted_at: string | null;
  /** False once a newer version is in force than the one accepted, or nothing was accepted yet. */
  terms_accepted: boolean;
  apple_linked: boolean;
  pasteis_remaining: number | null;
  pasteis_resets_at: string | null;
  /** null while Remotes are turned off. */
  remotes: RemotesSettings | null;
};

export type RemotesFrom = 'following' | 'everyone';

/** Who can push to the user, whether they share pulls, what the site lets them choose, and the unread badge. */
export type RemotesSettings = { from: RemotesFrom; pull_receipts: boolean; requests: boolean; everyone: boolean; unread_count: number };

export const PollDurations = [
  { minutes: 60, label: '1 hour' },
  { minutes: 1440, label: '1 day' },
  { minutes: 4320, label: '3 days' },
  { minutes: 10080, label: '7 days' },
] as const;

export type PollDuration = (typeof PollDurations)[number]['minutes'];

/** A poll being composed: 2 to 4 options of up to 50 characters, and how long it runs. */
export type NewPoll = { options: string[]; duration: PollDuration };

export const PollLimits = { minOptions: 2, maxOptions: 4, maxOptionLength: 50 } as const;

export const MessageMaxLength = 2000;

export const OrgLimits = { maxNameLength: 60, maxMembers: 100 } as const;

export type InboxTab = 'open' | 'fetched' | 'stashed';

export type PushAccess = 'open' | 'request' | 'waiting' | 'restricted' | 'closed';

export type OrgRole = 'maintainer' | 'contributor';

export type OrgEvent = 'created' | 'added' | 'removed' | 'left' | 'renamed' | 'promoted' | 'demoted' | 'inherited' | 'ping' | 'call_started' | 'call_answered' | 'call_cancelled' | 'call_declined' | 'call_missed' | 'call_failed';

/** How long a conversation stays quiet; `off` ends a mute. */
export type MuteDuration = 'hour' | 'tomorrow' | 'week' | 'forever' | 'off';

export type MessageReaction = { user_id: string; emoji: string };

export type ReactionUsage = { emoji: string; count: number };

export type MessageReply = { id: number; user_id: string; body: string; images_count: number; has_voice?: boolean };

export type MessageImage = { id: string; url: string; width: number; height: number; description: string | null };

export type MessageVoice = { id: string; duration_ms: number; waveform: number[]; url: string };

export type Message = {
  id: number;
  pinned_at?: string | null;
  user_id: string;
  client_id: string;
  body: string;
  body_segments?: BodySegment[] | null;
  reply_to_id?: number | null;
  reply_to?: MessageReply | null;
  link_preview?: LinkPreview | null;
  images?: MessageImage[];
  voice?: MessageVoice | null;
  reactions?: MessageReaction[];
  /** Orgs only: a logged change rather than something someone wrote. */
  event?: OrgEvent | null;
  subject_id?: string | null;
  user?: User;
  subject?: User | null;
  created_at: string;
};

export type OrgRef = { id: string; name: string | null };

export type OrgMember = { user: User; role: OrgRole | null; read_through_id?: number };

export type ConversationSummary = {
  id: string;
  kind: 'direct' | 'org';
  name: string | null;
  partner: User | null;
  members: { user: User; role: OrgRole | null }[] | null;
  last_message: Message | null;
  last_message_at: string | null;
  /** Messages from others the user hasn't pulled yet. */
  ahead: number;
  partner_read_through_id: number;
  partner_read_at: string | null;
  is_archived: boolean;
  pinned_at?: string | null;
  muted_until_at?: string | null;
};

export type InboxPage = { data: ConversationSummary[]; has_more: boolean; unread_count: number; requests_count: number };

export type ReactionChange = { id: number; reactions: MessageReaction[] };

type ThreadBase = { messages: Message[]; has_older: boolean; reactions_version: number; reaction_changes: ReactionChange[]; read_through_id: number; is_archived: boolean; pinned_at: string | null; muted_until_at: string | null; access: PushAccess };

export type DirectThread = ThreadBase & { kind: 'direct'; partner: User; partner_read_through_id: number; partner_read_at: string | null; partner_typing: boolean };

/** `pinned` is the org's pinned messages, newest pin first; null in a poll that found them unchanged. */
export type OrgThread = ThreadBase & { kind: 'org'; org: OrgRef; members: OrgMember[]; typing: string[]; role: OrgRole | null; pinned: Message[] | null };

export type Thread = DirectThread | OrgThread;

export type Candidate = { user: User; reason: string | null };

/** A relay the phones send the call through, with credentials good for one call. */
export type IceServer = { urls: string[]; username: string; credential: string };

/** The call ringing for the user: who, their offer, and whether that remote is muted. */
export type IncomingCall = { partner: User; sdp: string; is_muted: boolean };
