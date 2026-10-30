import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import { openLink } from '@/lib/links';
import type { LiveStream } from '@/lib/types';

export function platformName(platform: string): string {
  return platform === 'youtube' ? 'YouTube' : platform === 'twitch' ? 'Twitch' : platform;
}

/** The red LIVE pill the web puts beside anyone who is streaming; tapping it opens the stream. */
export function LiveBadge({ stream, size = 'sm' }: { stream: LiveStream; size?: 'sm' | 'md' }) {
  const theme = useTheme();

  return (
    <Pressable onPress={() => openLink(stream.url)} hitSlop={size === 'md' ? 11 : 14} accessibilityRole="link" accessibilityLabel={`Live on ${platformName(stream.platform)}. Opens the stream`} style={[styles.badge, { backgroundColor: theme.live }, size === 'md' && styles.badgeMd]}>
      <View style={[styles.dot, { backgroundColor: theme.liveInk }]} />
      <Text variant="monoMedium" color={theme.liveInk} style={size === 'md' ? styles.textMd : styles.text}>LIVE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16, paddingHorizontal: 5, borderRadius: Radius.sm },
  badgeMd: { height: 22, paddingHorizontal: 8, gap: 5, borderRadius: Radius.md },
  dot: { width: 4, height: 4, borderRadius: Radius.full },
  text: { fontSize: 10, lineHeight: 12, letterSpacing: 0.5, includeFontPadding: false },
  textMd: { fontSize: 11, lineHeight: 13, letterSpacing: 0.5, includeFontPadding: false },
});
