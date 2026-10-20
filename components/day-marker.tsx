import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';

export function DayMarker({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <View style={[styles.content, { borderBottomColor: theme.hairline }]}>
        <Text variant="mono" muted style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingVertical: 8, paddingRight: Space.gutter, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 12, lineHeight: 16 },
});
