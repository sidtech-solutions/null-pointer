import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import type { Commit } from '@/lib/types';

export function FollowingEmpty({ suggestions, onTrending, onOpenAuthor }: { suggestions: Commit[]; onTrending: () => void; onOpenAuthor: (username: string) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Text variant="mono" muted style={styles.center}>fatal: your log does not have any commits yet</Text>
      {suggestions.length === 0 ? (
        <Text style={styles.center}>
          Your log shows your commits and commits from people you follow. Find someone worth following on{' '}
          <Text color={theme.primary} onPress={onTrending}>Trending</Text>.
        </Text>
      ) : (
        <>
          <Text style={styles.center}>Your log shows your commits and commits from people you follow. Here is what a few developers committed lately:</Text>
          <View style={[styles.list, { borderColor: theme.hairline }]}>
            {suggestions.map((commit, index) => (
              <View key={commit.id} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline }]}>
                <Pressable onPress={() => onOpenAuthor(commit.author.handle)} accessibilityLabel={`${commit.author.name || commit.author.handle}'s profile`}>
                  <Avatar user={commit.author} size={36} />
                </Pressable>
                <View style={styles.column}>
                  <View style={styles.names}>
                    <Text variant="name" numberOfLines={1} style={[styles.shrink, styles.small]}>{commit.author.name || commit.author.handle}</Text>
                    <Text variant="mono" muted numberOfLines={1} style={styles.shrink}>@{commit.author.handle}</Text>
                  </View>
                  <Text variant="small" muted numberOfLines={1}>{commit.body}</Text>
                </View>
                <FollowButton username={commit.author.handle} isFollowing={false} />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: Space.gutterWide, gap: 12 },
  center: { textAlign: 'center', maxWidth: 320 },
  list: { width: '100%', marginTop: 8, borderWidth: 1, borderRadius: Radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  column: { flex: 1, gap: 2 },
  names: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  small: { fontSize: 14 },
});
