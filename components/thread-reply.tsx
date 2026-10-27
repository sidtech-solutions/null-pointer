import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { CommitActions, type CommitHandlers } from '@/components/commit-actions';
import { CommitBody } from '@/components/commit-body';
import { CommitMedia } from '@/components/commit-media';
import { DashedLine, RailSegment, ThreadElbow } from '@/components/graph-rail';
import { RelativeTime } from '@/components/relative-time';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { count } from '@/lib/display';
import type { Commit } from '@/lib/types';

const AvatarLine = Space.rail + 12;

// Thread connectors: the first reply joins the rail with an elbow in `lane`;
// later replies link from the reply above in `previousLane`; `hasNext` draws
// the line down to the next reply; `railLane` keeps the commit's rail running
// past the thread when its author's run continues below.
export const ThreadReply = memo(function ThreadReply({
  reply,
  lane,
  previousLane,
  hasNext,
  railLane,
  last,
  muted = false,
  more,
  indent = 0,
  spine,
  nestedOpen = false,
  onToggleNested,
  viewerId,
  handlers,
}: {
  reply: Commit;
  lane: string;
  previousLane?: string;
  hasNext: boolean;
  railLane?: string;
  last: boolean;
  muted?: boolean;
  more?: () => void;
  /** Nesting level for replies to a deleted reply, which has no page of its own. */
  indent?: number;
  /** Lane of the line continuing past a nested reply. */
  spine?: string;
  nestedOpen?: boolean;
  onToggleNested?: (reply: Commit) => void;
  viewerId: string | number | undefined;
  handlers: CommitHandlers;
}) {
  const theme = useTheme();
  const own = laneColor(theme, reply.author?.lane);
  const deleted = typeof reply.deleted_at === 'string';
  const avatarLine = AvatarLine + indent;

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <View style={styles.content}>
        <View style={[styles.reply, { paddingLeft: indent }, last && more === undefined && styles.lastReply]}>
          {deleted ? (
            <View style={[styles.avatar, { borderColor: theme.rail }]} />
          ) : (
            <Pressable onPress={handlers.onOpenAuthor ? () => handlers.onOpenAuthor?.(reply.author) : undefined} hitSlop={10} accessibilityLabel={`${reply.author.name || reply.author.handle}'s profile`}>
              <Avatar user={reply.author} size={24} />
            </Pressable>
          )}
          <View style={styles.column}>
            {deleted ? (
              <View style={styles.column}>
                <View style={styles.header}>
                  <Text variant="small" muted>
                    <Text variant="mono" muted style={styles.tiny}>[deleted]</Text> This commit was deleted.
                  </Text>
                </View>
                {onToggleNested && reply.replies_count > 0 && (
                  <Pressable onPress={() => onToggleNested(reply)} style={styles.nestedToggle} hitSlop={4} accessibilityRole="button" accessibilityLabel={nestedOpen ? 'Hide replies' : count(reply.replies_count, 'reply', 'replies')}>
                    {nestedOpen ? <ChevronDown size={14} color={theme.primary} strokeWidth={2} /> : <ChevronRight size={14} color={theme.primary} strokeWidth={2} />}
                    <Text variant="small" color={theme.primary} style={styles.tiny13}>{nestedOpen ? 'Hide replies' : count(reply.replies_count, 'reply', 'replies')}</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                {/* The text opens the reply; the actions under it are siblings, never nested in the press area. */}
                <Pressable onPress={() => handlers.onOpen?.(reply)} style={({ pressed }) => [styles.press, pressed && styles.pressed]} accessibilityRole="button" accessibilityHint="Opens the reply">
                  <View style={styles.header}>
                    <Text variant="name" muted={muted} numberOfLines={1} style={[styles.name, muted && styles.mutedName]}>{reply.author.name || reply.author.handle}</Text>
                    <Text variant="mono" muted style={styles.tiny}>·</Text>
                    <RelativeTime iso={reply.created_at} style={styles.tiny} />
                  </View>
                  <CommitBody body={reply.body} segments={reply.body_segments} size={muted ? 14 : 15} onOpenMention={handlers.onOpenAuthor ? (username) => handlers.onOpenAuthor?.({ handle: username } as Commit['author']) : undefined} />
                  <CommitMedia images={reply.images} preview={reply.link_preview} compact />
                </Pressable>
                <CommitActions commit={reply} viewerId={viewerId} compact={muted} withQuote={false} expandable={false} handlers={handlers} />
              </>
            )}
          </View>
        </View>

        {more && (
          <Pressable onPress={more} style={styles.more} accessibilityRole="button" accessibilityLabel="Show more replies">
            <View style={styles.moreDot}>
              <View style={[styles.moreRing, { backgroundColor: theme.inkMuted }]}>
                <View style={[styles.moreGap, { backgroundColor: theme.surface }]}>
                  <View style={[styles.moreCore, { backgroundColor: theme.inkMuted }]} />
                </View>
              </View>
            </View>
            <Text variant="small" muted style={styles.tiny13}>Show more</Text>
          </Pressable>
        )}

        {last && !muted && <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />}
      </View>

      {railLane !== undefined && <RailSegment lane={railLane} />}
      {spine !== undefined && <DashedLine lane={spine} x={AvatarLine} top={0} bottom={0} />}
      {previousLane === undefined ? <ThreadElbow lane={lane} from={indent > 0 ? AvatarLine : undefined} to={Space.rail + indent} /> : <DashedLine lane={previousLane} x={avatarLine} top={0} height={6} />}
      {hasNext && <DashedLine lane={own} x={avatarLine} top={38} bottom={more ? 34 : 0} />}
      {nestedOpen && <DashedLine lane={theme.rail} x={avatarLine} top={38} bottom={0} />}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail },
  reply: { flexDirection: 'row', paddingTop: 10, paddingRight: Space.gutter, gap: 8 },
  lastReply: { paddingBottom: 12 },
  avatar: { width: 24, height: 24, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed' },
  column: { flex: 1, gap: 4 },
  press: { gap: 4 },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  name: { flexShrink: 1, fontSize: 14 },
  mutedName: { fontSize: 13 },
  tiny: { fontSize: 12, lineHeight: 16 },
  tiny13: { fontSize: 13, lineHeight: 18 },
  nestedToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -2, paddingVertical: 2 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, paddingBottom: 12, paddingRight: Space.gutter },
  moreDot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  moreRing: { width: 18, height: 18, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  moreGap: { width: 14, height: 14, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  moreCore: { width: 8, height: 8, borderRadius: Radius.full },
  hairline: { height: StyleSheet.hairlineWidth, width: '100%' },
});
