import { StyleSheet, View } from 'react-native';

import { Radius, Space, useTheme } from '@/constants/theme';

/** The shape of a person row (avatar, name, handle) while the list loads, so nothing jumps when it arrives. */
export function PersonSkeleton({ count = 3 }: { count?: number }) {
  const theme = useTheme();

  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.row, { borderBottomColor: theme.hairline }]}>
          <View style={[styles.avatar, { backgroundColor: theme.wash }]} />
          <View style={styles.column}>
            <View style={[styles.bar, { width: '45%', backgroundColor: theme.wash }]} />
            <View style={[styles.bar, { width: '30%', backgroundColor: theme.wash }]} />
          </View>
          <View style={[styles.button, { backgroundColor: theme.wash }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 44, height: 44, borderRadius: Radius.full },
  column: { flex: 1, gap: 8 },
  bar: { height: 12, borderRadius: Radius.sm },
  button: { width: 72, height: 32, borderRadius: Radius.md },
});
