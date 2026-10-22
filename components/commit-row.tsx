import { CornerDownRight, ListOrdered } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CommitActions, type CommitHandlers } from '@/components/commit-actions';
import { CommitBody, isFolded } from '@/components/commit-body';
import { CommitPoll } from '@/components/commit-poll';
import { CommitMedia } from '@/components/commit-media';
import { GraphRail } from '@/components/graph-rail';
import { RelativeTime } from '@/components/relative-time';
import { Text } from '@/components/text';
import { laneColor, Space, useTheme } from '@/constants/theme';
import { relativeTime, shortHash } from '@/lib/display';
import { openLink } from '@/lib/links';
import type { Commit } from '@/lib/types';

export const CommitRow = memo(function CommitRow({
  commit,
  previousLane,
  continuesRun = false,
  continuesNext,
  focused = false,
  muted = false,
  withTail,
  threadBelow = false,
  repliesOpen = false,
  viewerId,
  handlers,
}: {
  commit: Commit;
  previousLane?: string;
  continuesRun?: boolean;
  /** Feed only: whether the author's run continues in the next row. */
  continuesNext?: boolean;
  focused?: boolean;
  muted?: boolean;
  withTail?: boolean;
  threadBelow?: boolean;
  repliesOpen?: boolean;
  viewerId: string | number | undefined;
  handlers: CommitHandlers;
}) {
  const theme = useTheme();
  const [unfolded, setUnfolded] = useState(false);
  const lane = laneColor(theme, commit.author?.lane);
  const deleted = typeof commit.deleted_at === 'string';
  const inFeed = continuesNext !== undefined;
  const tail = inFeed ? continuesNext || !continuesRun : (withTail ?? !focused);
  const endsWithDot = inFeed && !continuesRun && !continuesNext;
  const replyTail = threadBelow && !(inFeed && continuesNext);
  const hasHairline = !threadBelow;
  const inset = focused ? 16 : 12;

  if (deleted) {
    return (
      <View style={[styles.row, { backgroundColor: theme.surface }]}>
        <View style={[styles.content, { paddingTop: inset, paddingBottom: inset + 1, borderBottomColor: theme.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <Text variant="small" muted>
            <Text variant="mono" muted style={styles.tiny}>[deleted]</Text> This commit was deleted.
          </Text>
        </View>
        <GraphRail lane={theme.rail} previousLane={previousLane} node="tombstone" hasTail={tail} endsWithDot={endsWithDot} />
      </View>
    );
  }

  const open = focused ? undefined : () => handlers.onOpen?.(commit);
  const metaStyle = muted ? styles.tiny : undefined;
  const folded = !focused && !unfolded && isFolded(commit);
  const laterParts = commit.series_position && commit.series_size ? Math.max(0, commit.series_size - commit.series_position) : 0;
  const openMention = handlers.onOpenAuthor ? (username: string) => handlers.onOpenAuthor?.({ username } as Commit['author']) : undefined;
  const isOwn = viewerId !== undefined && String(commit.author?.id) === String(viewerId);
  const canVote = viewerId !== undefined && !isOwn && (commit.status === 'approved' || commit.status === '');

  // The header and body open the commit; the action row below them is a sibling, not a child, of that press area.
  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <View style={[styles.content, { paddingTop: inset, paddingBottom: threadBelow ? 0 : inset + (hasHairline ? 1 : 0), minHeight: muted ? 56 : 64 }, hasHairline && { borderBottomColor: theme.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Pressable onPress={open} disabled={!open} style={({ pressed }) => [styles.press, pressed && open !== undefined && styles.pressed]} accessibilityRole={open ? 'button' : undefined} accessibilityHint={open ? 'Opens the commit' : undefined}>
          <View style={styles.header}>
            <Text variant="name" muted={muted} numberOfLines={1} style={[styles.name, focused && styles.focusedName, muted && styles.mutedName]}>
              {commit.author.name || commit.author.username}
            </Text>
            <Text variant="mono" muted numberOfLines={1} style={[styles.shrink, metaStyle]}>@{commit.author.username}</Text>
            <Text variant="mono" muted style={metaStyle}>·</Text>
            <RelativeTime iso={commit.created_at} style={metaStyle} />
            {commit.series_position && commit.series_size ? (
              <View style={[styles.series, { backgroundColor: theme.primarySoft }]} accessibilityLabel={`Commit ${commit.series_position} of ${commit.series_size} in a series`}>
                <Text variant="mono" color={theme.primary} style={styles.tiny}>{commit.series_position}/{commit.series_size}</Text>
              </View>
            ) : null}
            {commit.status !== 'approved' && commit.status !== '' && (
              <View style={[styles.chip, { backgroundColor: theme.wash }]}>
                <Text variant="mono" muted style={styles.tiny}>{commit.status}</Text>
              </View>
            )}
            {!focused && !muted && (
              <>
                <View style={styles.spacer} />
                <Text variant="mono" muted>{commit.short_hash || shortHash(commit.id)}</Text>
              </>
            )}
          </View>

          {commit.parent && (
            <Pressable onPress={() => handlers.onOpen?.(commit.parent!)} style={styles.replyingTo} hitSlop={8}>
              <CornerDownRight size={12} color={theme.inkMuted} strokeWidth={2} />
              <Text variant="mono" muted style={styles.tiny}>
                replying to {typeof commit.parent.deleted_at === 'string' ? '[deleted]' : `@${commit.parent.author?.username}`}
              </Text>
            </Pressable>
          )}

          <CommitBody body={commit.body} segments={folded && commit.preview_segments ? commit.preview_segments : commit.body_segments} size={focused ? 17 : muted ? 14 : 15} muted={muted} numberOfLines={folded && !commit.preview_segments ? 8 : undefined} onOpenMention={openMention} onOpenLink={openLink} />
          {folded && (
            <Pressable onPress={() => setUnfolded(true)} hitSlop={10} style={styles.showMore} accessibilityRole="button">
              <Text variant="small" color={theme.primary} style={styles.tiny13}>Show more</Text>
            </Pressable>
          )}
          {commit.poll && <CommitPoll poll={commit.poll} canVote={canVote} onVote={handlers.onVote ? (optionId) => handlers.onVote?.(commit, optionId) : undefined} />}
          <CommitMedia images={commit.images} preview={commit.link_preview} compact={muted} />
          {laterParts > 0 && !focused && (
            <Pressable onPress={() => handlers.onOpen?.(commit)} style={styles.seriesMore} hitSlop={8} accessibilityLabel={`${laterParts} more ${laterParts === 1 ? 'commit' : 'commits'} in this series`}>
              <ListOrdered size={14} color={theme.primary} strokeWidth={2} />
              <Text variant="mono" color={theme.primary} style={styles.tiny}>{laterParts} more {laterParts === 1 ? 'commit' : 'commits'} in this series</Text>
            </Pressable>
          )}

          {commit.quoted_commit && (
            <Pressable onPress={() => handlers.onOpen?.(commit.quoted_commit!)} style={({ pressed }) => [styles.quoted, { borderColor: theme.hairline }, pressed && { backgroundColor: theme.wash }]}>
              <View style={styles.header}>
                <Text variant="name" numberOfLines={1} style={[styles.name, styles.mutedName]}>{commit.quoted_commit.author?.name || commit.quoted_commit.author?.username}</Text>
                <Text variant="mono" muted style={styles.tiny}>@{commit.quoted_commit.author?.username} · {relativeTime(commit.quoted_commit.created_at)}</Text>
              </View>
              <CommitBody body={commit.quoted_commit.body} segments={commit.quoted_commit.body_segments} size={14} numberOfLines={6} />
            </Pressable>
          )}

          {focused && <Text variant="mono" muted style={styles.hash}>{commit.short_hash || shortHash(commit.id)}</Text>}
        </Pressable>

        <CommitActions commit={commit} viewerId={viewerId} compact={muted} hasThread={threadBelow} repliesOpen={repliesOpen} withReplies={!focused} handlers={handlers} />
      </View>

      <GraphRail
        lane={lane}
        previousLane={previousLane}
        node={continuesRun ? 'dot' : 'avatar'}
        user={commit.author}
        hasTail={tail}
        endsWithDot={endsWithDot}
        replyTail={replyTail}
        avatarSize={muted ? 36 : 48}
        onPressNode={handlers.onOpenAuthor ? () => handlers.onOpenAuthor?.(commit.author) : undefined}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingRight: Space.gutter, gap: 4 },
  press: { gap: 4 },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  name: { flexShrink: 1 },
  focusedName: { fontSize: 16 },
  mutedName: { fontSize: 14 },
  shrink: { flexShrink: 1 },
  spacer: { flex: 1 },
  tiny: { fontSize: 12, lineHeight: 16 },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  replyingTo: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 24 },
  quoted: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 4, marginTop: 4 },
  series: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  seriesMore: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, minHeight: 28 },
  showMore: { alignSelf: 'flex-start', paddingVertical: 4, minHeight: 28, justifyContent: 'center' },
  tiny13: { fontSize: 13, lineHeight: 18 },
  hash: { marginTop: 4 },
});
