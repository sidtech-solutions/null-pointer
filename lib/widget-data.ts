import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './client';
import { relativeTime } from './display';
import { storage } from './storage';
import type { Lane, User } from './types';

/** What the home screen widget draws: the streak, the last seven days, the rank, and what is waiting in the app. */
export type WidgetData = {
  username: string;
  lane: Lane | null;
  current: number;
  longest: number;
  /** One cell per day, oldest first: how many commits and a 0 to 4 shade. */
  days: { weekday: string; count: number; level: number }[];
  total: number;
  commits: number;
  followers: number;
  following: number;
  level: number;
  rank: string;
  /** 0 to 1 toward the next Unix rank; null at the top. */
  progress: number | null;
  badges: number;
  badgesTotal: number;
  notifications: number;
  remotes: number;
  /** Pastéis left today, or null while pastéis mode is off. */
  pasteisLeft: number | null;
  /** The newest commits in the Following log, for the tall widget. */
  latest: { id: string; username: string; line: string; ago: string }[];
  fetchedAt: string;
};

const CacheKey = 'devnull.widget.streak.v2';
const AccountKey = 'devnull.account';
const Weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LatestCount = 3;

/** The 0 to 4 shade of each bucket against the busiest one, as the profile's activity graph shades its cells. */
export function levelsOf(buckets: { date: string; count: number }[]): { weekday: string; count: number; level: number }[] {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return buckets.map((bucket) => {
    const date = new Date(bucket.date);

    return {
      weekday: Number.isNaN(date.getTime()) ? '' : Weekdays[date.getUTCDay()],
      count: bucket.count,
      level: bucket.count === 0 ? 0 : Math.max(1, Math.ceil((bucket.count / max) * 4)),
    };
  });
}

/** The first line of a commit, trimmed, with code fences and markers out of the way. */
export function firstLine(body: string): string {
  const line = body
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate !== '' && !candidate.startsWith('```'));

  return (line ?? '').replace(/^>\s?/, '');
}

export function cachedWidgetData(): WidgetData | null {
  try {
    const raw = storage.getString(CacheKey);

    return raw ? (JSON.parse(raw) as WidgetData) : null;
  } catch {
    return null;
  }
}

export function forgetWidgetData(): void {
  storage.remove(CacheKey);
}

/** Fresh numbers from devnull for the signed-in user, kept for the next draw; null when nobody is signed in. */
export async function loadWidgetData(): Promise<WidgetData | null> {
  const raw = await AsyncStorage.getItem(AccountKey);

  if (!raw) {
    forgetWidgetData();

    return null;
  }

  const account = JSON.parse(raw) as User;
  const [me, profile, log] = await Promise.all([api.me(), api.profile(account.handle), api.log('following').catch(() => null)]);
  const buckets = profile.activity?.buckets.slice(-7) ?? [];
  const days = levelsOf(buckets);
  const achievements = profile.achievements;
  // The server sends level_progress as a percentage, as the achievements sheet draws it; null at the top rank.
  const progress = achievements?.next_level_xp == null ? null : typeof achievements.level_progress === 'number' ? Math.min(1, Math.max(0, achievements.level_progress / 100)) : Math.min(1, Math.max(0, (achievements.xp ?? 0) / achievements.next_level_xp));
  const now = Date.now();
  const data: WidgetData = {
    username: profile.user.handle,
    lane: profile.user.lane ?? me.user.lane ?? null,
    current: profile.streaks.current,
    longest: profile.streaks.longest,
    days,
    total: days.reduce((sum, day) => sum + day.count, 0),
    commits: profile.commits_count,
    followers: profile.followers_count,
    following: profile.following_count,
    level: achievements?.level ?? 0,
    rank: achievements?.rank ?? '',
    progress,
    badges: achievements?.badges?.filter((badge) => badge.unlocked).length ?? 0,
    badgesTotal: achievements?.badges?.length ?? 0,
    notifications: me.unread_notifications_count,
    remotes: me.remotes?.unread_count ?? 0,
    pasteisLeft: me.pasteis_mode ? (me.pasteis_remaining ?? null) : null,
    latest: (log?.data ?? [])
      .filter((commit) => !commit.deleted_at)
      .slice(0, LatestCount)
      .map((commit) => ({ id: commit.id, username: commit.author.handle, line: firstLine(commit.body) || (commit.images?.length ? 'an image' : commit.poll ? 'a poll' : ''), ago: relativeTime(commit.created_at, now) })),
    fetchedAt: new Date().toISOString(),
  };

  storage.set(CacheKey, JSON.stringify(data));

  return data;
}
