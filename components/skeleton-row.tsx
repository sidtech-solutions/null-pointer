import { StyleSheet, View } from 'react-native';

import { ActionHeight } from '@/components/commit-actions';
import { GraphRail } from '@/components/graph-rail';
import { Radius, Space, useTheme } from '@/constants/theme';

/** The shape of a CommitRow (header, two body lines, the action row) while the log loads, so nothing jumps when it arrives. */
export function SkeletonRow({ previousLane }: { previousLane?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <View style={[styles.content, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.bar, { width: '40%', backgroundColor: theme.wash }]} />
        <View style={[styles.bar, { width: '92%', backgroundColor: theme.wash }]} />
        <View style={[styles.bar, { width: '70%', backgroundColor: theme.wash }]} />
        <View style={styles.actions}>
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} style={[styles.action, { backgroundColor: theme.wash }]} />
          ))}
        </View>
      </View>
      <GraphRail lane={theme.rail} previousLane={previousLane ?? undefined} node="skeleton" endsWithDot />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingTop: Space.rowY + 4, paddingBottom: Space.rowY - 2, paddingRight: Space.gutter, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { height: 12, borderRadius: Radius.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, height: ActionHeight - 8, marginTop: -2 },
  action: { width: 18, height: 18, borderRadius: Radius.full },
});
