import { CircleDot } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import type { IssueSuggestion as Issue } from '@/lib/types';

/** The /dev/null issue matching the `#number` being typed, one row above the keyboard. */
export function IssueSuggestion({ issue, onPick }: { issue: Issue | null; onPick: (issue: Issue) => void }) {
  const theme = useTheme();

  if (!issue) {
    return null;
  }

  return (
    <View style={[styles.list, { borderTopColor: theme.hairline, backgroundColor: theme.surface }]} accessibilityRole="menu" accessibilityLabel="Issue to reference">
      <Pressable onPress={() => onPick(issue)} android_ripple={{ color: theme.wash }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.wash }]} accessibilityRole="menuitem" accessibilityLabel={`Reference issue ${issue.number}, ${issue.title}`}>
        <CircleDot size={16} color={theme.primary} strokeWidth={2} />
        <Text variant="mono" color={theme.primary}>#{issue.number}</Text>
        <Text variant="small" numberOfLines={1} style={styles.title}>{issue.title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: Space.gutter },
  title: { flexShrink: 1 },
});
