import { ArrowUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';

export function NewCommitsPill({ count, more = false, onPress }: { count: number; more?: boolean; onPress: () => void }) {
  const theme = useTheme();

  if (count <= 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? theme.primaryHover : theme.primary }]} accessibilityRole="button">
        <ArrowUp size={14} color={theme.primaryInk} strokeWidth={2.5} />
        <Text variant="label" color={theme.primaryInk}>
          {count}
          {more ? '+' : ''} new {count === 1 && !more ? 'commit' : 'commits'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 14, borderRadius: Radius.full },
});
