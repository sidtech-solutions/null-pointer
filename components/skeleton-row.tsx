import { StyleSheet, View } from 'react-native';

import { GraphRail } from '@/components/graph-rail';
import { Radius, Space, useTheme } from '@/constants/theme';

export function SkeletonRow({ previousLane }: { previousLane?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <View style={[styles.content, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.bar, { width: '40%', backgroundColor: theme.wash }]} />
        <View style={[styles.bar, { width: '92%', backgroundColor: theme.wash }]} />
        <View style={[styles.bar, { width: '70%', backgroundColor: theme.wash }]} />
      </View>
      <GraphRail lane={theme.rail} previousLane={previousLane ?? undefined} node="skeleton" endsWithDot />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingVertical: Space.rowY + 4, paddingRight: Space.gutter, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { height: 12, borderRadius: Radius.sm },
});
