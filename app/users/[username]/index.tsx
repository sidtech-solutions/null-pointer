import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/header';
import { ProfileView } from '@/components/profile-view';
import { Text } from '@/components/text';
import { useTheme } from '@/constants/theme';

export default function UserScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="mono" style={styles.title}>@{username}</Text>
          </View>
        }
      />
      <ProfileView username={username} bottomInset={insets.bottom} onOpenConnections={(type) => router.push({ pathname: '/users/[username]/[type]', params: { username, type } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15 },
});
