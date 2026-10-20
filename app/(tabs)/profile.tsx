import { useRouter } from 'expo-router';
import { Settings2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/header';
import { ProfileView } from '@/components/profile-view';
import { useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const username = account.user?.username;

  if (!username) {
    return <View style={[styles.screen, { backgroundColor: theme.surface }]} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title="Profile"
        right={
          <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Settings">
            <Settings2 size={22} color={theme.ink} strokeWidth={2} />
          </Pressable>
        }
      />
      <ProfileView username={username} onOpenConnections={(type) => router.push({ pathname: '/users/[username]/[type]', params: { username, type } })} onOpenStarred={() => router.push('/starred')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
