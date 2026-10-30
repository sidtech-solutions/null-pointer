import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { NullPointerMark } from '@/components/mark';
import { Text } from '@/components/text';
import { useTheme } from '@/constants/theme';

// Matches the splash screen's mark, size and background so the hand-off is
// invisible. The caption only fades in if the wait is long enough to notice.
export function LoadingScreen({ caption = 'git fetch…' }: { caption?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell }]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <NullPointerMark width={120} />
      <Animated.View entering={FadeIn.delay(600).duration(300)} style={styles.caption}>
        <Text variant="mono" muted>{caption}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', bottom: 64 },
});
