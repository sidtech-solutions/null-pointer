import { Appearance, useColorScheme } from 'react-native';

import { storage } from '@/lib/storage';

// devnull web app design tokens.
export type Tokens = {
  dark: boolean;
  shell: string;
  surface: string;
  popover: string;
  ink: string;
  inkMuted: string;
  hairline: string;
  rail: string;
  wash: string;
  primary: string;
  primaryHover: string;
  primarySoft: string;
  primaryInk: string;
  destructive: string;
  lanes: readonly [string, string, string, string, string, string];
};

export const light: Tokens = {
  dark: false,
  shell: '#f6f7f8',
  surface: '#ffffff',
  popover: '#ffffff',
  ink: '#121417',
  inkMuted: '#5b616b',
  hairline: '#e1e4e8',
  rail: '#d3d7dd',
  wash: '#eef0f2',
  primary: '#3b6fe0',
  primaryHover: '#2e5ccb',
  primarySoft: '#e8effc',
  primaryInk: '#ffffff',
  destructive: '#c92a2a',
  lanes: ['#d9480f', '#2f9e44', '#9c36b5', '#0c8599', '#c2255c', '#b7791f'],
};

export const dark: Tokens = {
  dark: true,
  shell: '#111112',
  surface: '#18181a',
  popover: '#1f1f22',
  ink: '#ececec',
  inkMuted: '#a1a1a6',
  hairline: '#2a2a2d',
  rail: '#36363a',
  wash: '#232326',
  primary: '#7aa2f7',
  primaryHover: '#94b5f9',
  primarySoft: '#18233a',
  primaryInk: '#111112',
  destructive: '#ff6b6b',
  lanes: ['#ff8a4c', '#51cf66', '#da77f2', '#3bc9db', '#f06595', '#fcc419'],
};

export const Fonts = {
  sans: 'Geist-Regular',
  sansSemiBold: 'Geist-SemiBold',
  mono: 'GeistMono-Regular',
  monoMedium: 'GeistMono-Medium',
} as const;

export const Radius = { sm: 4, md: 6, lg: 8, full: 9999 } as const;

/** Points. */
export const Space = {
  rowY: 12,
  gutter: 16,
  gutterWide: 24,
  rail: 64,
  railCenter: 32,
  avatar: 40,
  node: 14,
  header: 56,
} as const;

export const LaneCount = 6;

export type ThemePreference = 'system' | 'light' | 'dark';

const ThemeKey = 'devnull.theme';

export function themePreference(): ThemePreference {
  const stored = storage.getString(ThemeKey);

  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function setThemePreference(preference: ThemePreference): void {
  storage.set(ThemeKey, preference);
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

export function applyThemePreference(): void {
  const preference = themePreference();

  if (preference !== 'system') {
    Appearance.setColorScheme(preference);
  }
}

export function useTheme(): Tokens {
  return useColorScheme() === 'dark' ? dark : light;
}

/** A lane is a palette index, a custom #rrggbb, or null (rail grey). */
export function laneColor(theme: Tokens, lane: number | string | null | undefined): string {
  if (typeof lane === 'string' && /^#[0-9a-f]{6}$/i.test(lane)) {
    return lane.toLowerCase();
  }

  const index = typeof lane === 'string' && /^\d+$/.test(lane) ? Number(lane) : lane;

  if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < LaneCount) {
    return theme.lanes[index];
  }

  return theme.rail;
}
