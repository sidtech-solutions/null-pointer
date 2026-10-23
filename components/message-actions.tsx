import { CornerUpLeft } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  onReact,
  onReply,
  onClose,
}: {
  message: Message | null;
  me: User | null | undefined;
  reactions: string[];
  canReact: boolean;
  canReply: boolean;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={message !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={styles.backdrop} accessibilityLabel="Close" accessibilityRole="button">
        <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) }]}>
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

              {!canReact && !canReply && <Text variant="small" muted style={styles.gist}>Nothing to do with this message until the conversation opens.</Text>}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: Space.gutter, gap: 8 },
  gist: { paddingHorizontal: 4, paddingBottom: 4 },
  reactions: { flexDirection: 'row', justifyContent: 'space-between' },
  reaction: { width: 48, height: 48, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, lineHeight: 30 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, paddingHorizontal: 8, borderRadius: Radius.md },
});
