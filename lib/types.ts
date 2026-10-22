export type Lane = number | string | null;

export type User = {
  id: string | number;
  username: string;
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
  followers_count?: number;
  following_count?: number;
  commits_count?: number;
};

export type ReplyPreview = {
  data: Commit[];
  next_cursor?: string | null;
};

export type CommitImage = { id?: string; url: string; width?: number; height?: number; description?: string | null };

export type LinkPreview = { url: string; title?: string | null; description?: string | null; image_url?: string | null; site_name?: string | null };

export type BodySegment = { type: 'text'; text: string } | { type: 'code'; code: string } | { type: 'block'; language?: string | null; code?: string };

export type Mention = { username: string; offset?: number; length?: number };

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
  apple_linked: boolean;
  pasteis_remaining: number | null;
  pasteis_resets_at: string | null;
};

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
