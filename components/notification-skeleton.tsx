import { StyleSheet, View } from 'react-native';

import { Radius, Space, useTheme } from '@/constants/theme';

/** The shape of a NotificationRow (node on the rail, stacked avatars, a sentence, a line of body) while the list loads. */
export function NotificationSkeleton({ count = 5 }: { count?: number }) {
  const theme = useTheme();

  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.row, { backgroundColor: theme.surface }]}>
          <View style={styles.content}>
            <View style={styles.head}>
              <View style={[styles.avatar, { backgroundColor: theme.wash }]} />
              <View style={styles.spacer} />
              <View style={[styles.bar, styles.time, { backgroundColor: theme.wash }]} />
            </View>
            <View style={[styles.bar, { width: '72%', backgroundColor: theme.wash }]} />
            <View style={[styles.bar, { width: '90%', backgroundColor: theme.wash }]} />
          </View>
          <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />
          {index > 0 && <View style={[styles.railTop, { backgroundColor: theme.rail }]} />}
          <View style={[styles.railBottom, { backgroundColor: theme.rail }]} />
          <View style={[styles.node, { borderColor: theme.rail, backgroundColor: theme.surface }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingVertical: 12, paddingRight: Space.gutter, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  avatar: { width: 32, height: 32, borderRadius: Radius.full },
  spacer: { flex: 1 },
  bar: { height: 12, borderRadius: Radius.sm },
  time: { width: 28 },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: Space.rail },
  railTop: { position: 'absolute', top: 0, left: Space.rail / 2 - 1, width: 2, height: 32 },
  railBottom: { position: 'absolute', top: 32, bottom: 0, left: Space.rail / 2 - 1, width: 2 },
  node: { position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: Radius.full, borderWidth: 2 },
});
