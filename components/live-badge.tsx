import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius } from '@/constants/theme';
import { openLink } from '@/lib/links';
import type { LiveStream } from '@/lib/types';

const Red = '#e5484d';

export function platformName(platform: string): string {
  return platform === 'youtube' ? 'YouTube' : platform === 'twitch' ? 'Twitch' : platform;
}

/** The red LIVE pill the web puts beside anyone who is streaming; tapping it opens the stream. */
export function LiveBadge({ stream, size = 'sm' }: { stream: LiveStream; size?: 'sm' | 'md' }) {
  return (
    <Pressable onPress={() => openLink(stream.url)} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Live on ${platformName(stream.platform)}. Opens the stream`} style={[styles.badge, size === 'md' && styles.badgeMd]}>
      <View style={styles.dot} />
      <Text variant="monoMedium" color="#ffffff" style={size === 'md' ? styles.textMd : styles.text}>LIVE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16, paddingHorizontal: 5, borderRadius: Radius.sm, backgroundColor: Red },
  badgeMd: { height: 22, paddingHorizontal: 8, gap: 5, borderRadius: Radius.md },
  dot: { width: 4, height: 4, borderRadius: Radius.full, backgroundColor: '#ffffff' },
  text: { fontSize: 9, lineHeight: 11, letterSpacing: 0.5, includeFontPadding: false },
  textMd: { fontSize: 11, lineHeight: 13, letterSpacing: 0.5, includeFontPadding: false },
});
