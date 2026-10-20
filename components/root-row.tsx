import { StyleSheet, View } from 'react-native';

import { GraphRail } from '@/components/graph-rail';
import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';

export function RootRow({ children = "That's the root commit. There's nothing before it." }: { children?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <View style={styles.content}>
        <Text muted>{children}</Text>
      </View>
      <GraphRail lane={theme.rail} node="root" hasTail={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', minHeight: 64 },
  content: { marginLeft: Space.rail, paddingVertical: 20, paddingRight: Space.gutter },
});
