import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';

export function LastVisitMarker() {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]} accessibilityLabel="Commits above are new since your last visit">
      <View style={[styles.content, { borderBottomColor: theme.hairline }]}>
        <Text variant="mono" muted style={styles.label}>HEAD@{'{last visit}'}</Text>
        <View style={[styles.dashes, { borderColor: theme.hairline }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingVertical: 8, paddingRight: Space.gutter, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 12, lineHeight: 16 },
  dashes: { flex: 1, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
});
