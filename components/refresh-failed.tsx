import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';

export function RefreshFailed({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onRetry} style={[styles.row, { backgroundColor: theme.surface, borderBottomColor: theme.hairline }]} accessibilityRole="button" accessibilityLabel="Couldn't refresh. Retry">
      <Text variant="mono" muted style={styles.shrink}>warning: couldn’t refresh</Text>
      <View style={styles.spacer} />
      <Text variant="small" color={theme.primary}>Retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  shrink: { flexShrink: 1 },
  spacer: { flex: 1 },
});
