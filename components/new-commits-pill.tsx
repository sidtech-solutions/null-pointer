import { ArrowUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';

const Settle = Easing.bezier(0.23, 1, 0.32, 1);

/** Floats over the log when newer commits arrived above the fold; a floating overlay, never a recycled row, so it may enter. */
export function NewCommitsPill({ count, more = false, onPress }: { count: number; more?: boolean; onPress: () => void }) {
  const theme = useTheme();

  if (count <= 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInUp.duration(240).easing(Settle)} exiting={FadeOutUp.duration(160)}>
        <Pressable onPress={onPress} hitSlop={{ top: 6, bottom: 6 }} style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? theme.primaryHover : theme.primary }]} accessibilityRole="button">
          <ArrowUp size={14} color={theme.primaryInk} strokeWidth={2.5} />
          <Text variant="label" color={theme.primaryInk} style={styles.count}>
            {count}
            {more ? '+' : ''} new {count === 1 && !more ? 'commit' : 'commits'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 1, pointerEvents: 'box-none' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 14, borderRadius: Radius.full },
  count: { fontVariant: ['tabular-nums'] },
});
