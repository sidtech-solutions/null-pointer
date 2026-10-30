import { CornerUpLeft, Pin, PinOff } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { hasReacted, messageGist } from '@/lib/remotes';
import type { Message, User } from '@/lib/types';

/**
 * The sheet a long press opens: six reactions one tap away, and Reply. The
 * sheet closes itself after either, as the web's picker does.
 */
export function MessageActions({
  message,
  me,
  reactions,
  canReact,
  canReply,
  canPin = false,
  pinned = false,
  onReact,
  onReply,
  onPin,
  onClose,
}: {
  message: Message | null;
  me: User | null | undefined;
  reactions: string[];
  canReact: boolean;
  canReply: boolean;
  /** Orgs only, and only for maintainers: keeps the message at the top of the thread. */
  canPin?: boolean;
  pinned?: boolean;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onPin?: (message: Message, pinned: boolean) => void;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <Sheet visible={message !== null} onClose={onClose} style={styles.sheet}>
          {message && (
            <>
              <Text variant="small" muted numberOfLines={2} style={styles.gist}>{messageGist(message) || 'Message'}</Text>

              {canReact && (
                <View style={styles.reactions} accessibilityRole="menu">
                  {reactions.map((emoji) => {
                    const on = hasReacted(message.reactions, me, emoji);

                    return (
                      <Pressable
                        key={emoji}
                        onPress={() => {
                          onReact(message, emoji);
                          onClose();
                        }}
                        style={({ pressed }) => [styles.reaction, { backgroundColor: on ? theme.primarySoft : pressed ? theme.wash : 'transparent', borderColor: on ? theme.primary : 'transparent' }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${on ? 'Take back' : 'React with'} ${emoji}`}>
                        <Text style={styles.emoji}>{emoji}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {canReply && (
                <Pressable
                  onPress={() => {
                    onReply(message);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.action, { backgroundColor: pressed ? theme.wash : 'transparent' }]}
                  accessibilityRole="button">
                  <CornerUpLeft size={18} color={theme.ink} strokeWidth={2} />
                  <Text>Reply</Text>
                </Pressable>
              )}

              {canPin && onPin && (
                <Pressable
                  onPress={() => {
                    onPin(message, !pinned);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.action, { backgroundColor: pressed ? theme.wash : 'transparent' }]}
                  accessibilityRole="button">
                  {pinned ? <PinOff size={18} color={theme.ink} strokeWidth={2} /> : <Pin size={18} color={theme.ink} strokeWidth={2} />}
                  <Text>{pinned ? 'Unpin' : 'Pin to the top'}</Text>
                </Pressable>
              )}

              {!canReact && !canReply && !canPin && <Text variant="small" muted style={styles.gist}>Nothing to do with this message until the conversation opens.</Text>}
            </>
          )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: 12, paddingHorizontal: Space.gutter, gap: 8 },
  gist: { paddingHorizontal: 4, paddingBottom: 4 },
  reactions: { flexDirection: 'row', justifyContent: 'space-between' },
  reaction: { width: 48, height: 48, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, lineHeight: 30 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, paddingHorizontal: 8, borderRadius: Radius.md },
});
