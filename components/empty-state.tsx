import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/constants/theme';

export function EmptyState({ fatal, children, action, onAction }: { fatal: string; children?: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Text variant="mono" muted style={styles.center}>{fatal}</Text>
      {children && <Text style={styles.center}>{children}</Text>}
      {action && (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
          <Text color={theme.primary} style={styles.center}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8, maxWidth: 384, alignSelf: 'center' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
