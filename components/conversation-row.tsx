import { Check, CheckCheck, Users } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { RelativeTime } from '@/components/relative-time';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { conversationTitle, isMine, previewText } from '@/lib/remotes';
import type { ConversationSummary, User } from '@/lib/types';

/** An org's avatar: its two first members, or a group mark when it has no one else in it. */
export function OrgAvatar({ members, me, size = 44 }: { members: { user: User }[] | null | undefined; me: User | null | undefined; size?: number }) {
  const theme = useTheme();
  const others = (members ?? []).map((member) => member.user).filter((user) => String(user.id) !== String(me?.id));
  const small = Math.round(size * 0.68);

  if (others.length < 2) {
    return others.length === 1 ? (
      <Avatar user={others[0]} size={size} />
    ) : (
      <View style={{ width: size, height: size, borderRadius: Radius.full, backgroundColor: theme.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Users size={Math.round(size * 0.45)} color={theme.inkMuted} strokeWidth={2} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Avatar user={others[0]} size={small} />
      </View>
      <View style={{ position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: theme.surface, borderRadius: Radius.full }}>
        <Avatar user={others[1]} size={small} />
      </View>
    </View>
  );
}

export const ConversationRow = memo(function ConversationRow({
  conversation,
  me,
  onPress,
  onLongPress,
}: {
  conversation: ConversationSummary;
  me: User | null | undefined;
  onPress: (conversation: ConversationSummary) => void;
  onLongPress?: (conversation: ConversationSummary) => void;
}) {
  const theme = useTheme();
  const title = conversationTitle(conversation, me);
  const preview = previewText(conversation, me);
  const unread = conversation.ahead > 0;
  const last = conversation.last_message;
  const mineLast = last !== null && !last.event && isMine(last, me);
  const pulled = mineLast && conversation.partner_read_through_id >= (last?.id ?? 0);
  const lane = conversation.partner ? laneColor(theme, conversation.partner.lane) : theme.rail;

  return (
    <Pressable
      onPress={() => onPress(conversation)}
      onLongPress={onLongPress ? () => onLongPress(conversation) : undefined}
      delayLongPress={350}
      android_ripple={{ color: theme.wash }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.wash : theme.surface, borderBottomColor: theme.hairline }]}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? `${conversation.ahead} ahead. ` : ''}${title}. ${preview}`}>
      <View style={styles.avatar}>
        {conversation.kind === 'org' || !conversation.partner ? <OrgAvatar members={conversation.members} me={me} /> : <Avatar user={conversation.partner} size={44} lane={lane} />}
      </View>

      <View style={styles.body}>
        <View style={styles.head}>
          <Text variant="name" numberOfLines={1} style={styles.title}>{title}</Text>
          {conversation.partner && (
            <Text variant="mono" muted numberOfLines={1} style={[styles.handle, styles.tiny]}>@{conversation.partner.username}</Text>
          )}
          <RelativeTime iso={conversation.last_message_at} style={styles.tiny} />
        </View>

        <View style={styles.previewRow}>
          {mineLast && (pulled ? <CheckCheck size={14} color={theme.primary} strokeWidth={2} /> : <Check size={14} color={theme.inkMuted} strokeWidth={2} />)}
          <Text variant="small" muted={!unread} numberOfLines={1} style={styles.preview}>{preview}</Text>
          {unread && (
            <View style={[styles.ahead, { backgroundColor: theme.primary }]} accessibilityLabel={`${conversation.ahead} unread`}>
              <Text variant="mono" color={theme.primaryInk} style={styles.aheadText}>{conversation.ahead > 99 ? '99+' : conversation.ahead}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.rowY, paddingHorizontal: Space.gutter, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  avatar: { width: 52, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1 },
  handle: { flexShrink: 1 },
  tiny: { fontSize: 12, lineHeight: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  preview: { flex: 1 },
  ahead: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  aheadText: { fontSize: 11, lineHeight: 14 },
});
