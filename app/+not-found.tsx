import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { useTheme } from '@/constants/theme';

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={[styles.screen, { backgroundColor: theme.shell }]}>
        <EmptyState fatal="fatal: path does not exist in 'HEAD'">This screen doesn’t exist.</EmptyState>
        <Link href="/" style={{ color: theme.primary, textAlign: 'center' }}>
          Back to your log
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
});
