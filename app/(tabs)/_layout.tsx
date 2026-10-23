import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { Bell, GitCommitVertical, MessagesSquare, UserRound } from 'lucide-react-native';
import { type ColorValue, StyleSheet, View } from 'react-native';

import { Fonts, laneColor, Radius, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api } from '@/lib/client';

export default function TabLayout() {
  const theme = useTheme();
  const { user, status } = useAccount();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled: status === 'signed-in', staleTime: 60_000, refetchInterval: 30_000 });
  const unread = me.data?.unread_notifications_count ?? 0;
  const unreadRemotes = me.data?.remotes?.unread_count ?? 0;
  const badgeStyle = { backgroundColor: theme.primary, color: theme.primaryInk, fontFamily: Fonts.mono, fontSize: 11 };
  const accent = user?.lane !== null && user?.lane !== undefined ? laneColor(theme, user.lane) : theme.primary;

  const icon = (Icon: typeof Bell) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
      return (
        <View style={[styles.pill, focused && { backgroundColor: theme.primarySoft }]}>
          <Icon size={22} color={typeof color === "string" ? color : theme.inkMuted} strokeWidth={2} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: theme.inkMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontFamily: Fonts.sans, fontSize: 12 },
        sceneStyle: { backgroundColor: theme.surface },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Log', tabBarIcon: icon(GitCommitVertical) }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', tabBarIcon: icon(Bell), tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined, tabBarBadgeStyle: badgeStyle }} />
      <Tabs.Screen name="remotes" options={{ title: 'Remotes', tabBarIcon: icon(MessagesSquare), tabBarBadge: unreadRemotes > 0 ? (unreadRemotes > 99 ? '99+' : unreadRemotes) : undefined, tabBarBadgeStyle: badgeStyle }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon(UserRound) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 56, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
