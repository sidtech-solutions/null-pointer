import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { useTheme } from '@/constants/theme';

export default function RemotesScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header title="Remotes" />
      <EmptyState fatal="fatal: no remotes configured">Remotes need the API branches that aren’t merged upstream yet.</EmptyState>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
