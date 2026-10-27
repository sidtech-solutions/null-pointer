import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import type { User } from '@/lib/types';

/** The people matching the handle being typed, one row each, above the keyboard. */
export function MentionSuggestions({ users, onPick }: { users: User[]; onPick: (user: User) => void }) {
  const theme = useTheme();

  if (users.length === 0) {
    return null;
  }

  return (
    <View style={[styles.list, { borderTopColor: theme.hairline, backgroundColor: theme.surface }]} accessibilityRole="menu" accessibilityLabel="People to mention">
      {users.map((user) => (
        <Pressable
          key={String(user.id)}
          onPress={() => onPick(user)}
          android_ripple={{ color: theme.wash }}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.wash }]}
          accessibilityRole="menuitem"
          accessibilityLabel={`Mention @${user.handle}`}>
          <Avatar user={user} size={28} />
          <Text variant="small" numberOfLines={1} style={styles.name}>{user.name || user.handle}</Text>
          <Text variant="mono" muted numberOfLines={1} style={styles.handle}>@{user.handle}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: Space.gutter },
  name: { flexShrink: 1 },
  handle: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
});
