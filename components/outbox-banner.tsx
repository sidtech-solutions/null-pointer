import { useRouter } from 'expo-router';
import { CloudOff, Send } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import { useOnline } from '@/lib/network';
import { useOutbox } from '@/lib/use-outbox';

/** Above the log: offline, the cache is what is showing; and commits waiting in the outbox say so. */
export function OutboxBanner() {
  const theme = useTheme();
  const router = useRouter();
  const online = useOnline();
  const items = useOutbox();
  const failed = items.filter((item) => item.error !== null).length;

  if (online && items.length === 0) {
    return null;
  }

  return (
    <View>
      {!online && (
        <View style={[styles.row, { backgroundColor: theme.surface, borderBottomColor: theme.hairline }]} accessibilityLiveRegion="polite">
          <CloudOff size={14} color={theme.inkMuted} strokeWidth={2} />
          <Text variant="mono" muted style={styles.shrink}>offline · reading from cache</Text>
        </View>
      )}
      {items.length > 0 && (
        <Pressable onPress={() => router.push('/outbox')} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.wash : theme.surface, borderBottomColor: theme.hairline }]} accessibilityRole="button" accessibilityLabel={`${items.length} in the outbox`}>
          <Send size={14} color={failed > 0 ? theme.destructive : theme.primary} strokeWidth={2} />
          <Text variant="mono" muted style={styles.shrink} numberOfLines={1}>
            {items.length} {items.length === 1 ? 'commit' : 'commits'} {failed > 0 ? `in the outbox, ${failed} refused` : online ? 'pushing…' : 'waiting for a connection'}
          </Text>
          <View style={styles.spacer} />
          <Text variant="small" color={theme.primary}>Outbox</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Space.gutter, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  shrink: { flexShrink: 1 },
  spacer: { flex: 1 },
});
