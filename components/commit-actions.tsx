import { ChevronDown, ChevronRight, Ellipsis, MessageSquareReply, Quote, Star } from 'lucide-react-native';
import { Image } from 'expo-image';
import { ActionSheetIOS, Alert, Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/constants/theme';
import { baseUrl } from '@/lib/client';
import { count } from '@/lib/display';
import type { Commit, User } from '@/lib/types';

export type CommitHandlers = {
  onStar?: (commit: Commit) => void;
  onReply?: (commit: Commit) => void;
  onQuote?: (commit: Commit) => void;
  onOpen?: (commit: Commit) => void;
  onDelete?: (commit: Commit) => void;
  onOpenAuthor?: (user: User) => void;
  /** Feed only: toggles the reply thread in place. */
  onToggleReplies?: (commit: Commit) => void;
  onReport?: (commit: Commit) => void;
  onPastel?: (commit: Commit) => void;
  /** Pastéis left today, or null when the mode is off. */
  pasteisLeft?: number | null;
};

export function CommitActions({
  commit,
  viewerId,
  compact = false,
  withQuote = true,
  withReplies = true,
  hasThread = false,
  repliesOpen = false,
  expandable = true,
  handlers,
}: {
  commit: Commit;
  viewerId: string | number | undefined;
  compact?: boolean;
  withQuote?: boolean;
  withReplies?: boolean;
  hasThread?: boolean;
  repliesOpen?: boolean;
  /** Whether the replies count opens the thread in place instead of the commit page. */
  expandable?: boolean;
  handlers: CommitHandlers;
}) {
  const theme = useTheme();
  const isOwn = viewerId !== undefined && String(commit.author?.id) === String(viewerId);
  const isApproved = commit.status === 'approved' || commit.status === '';
  const pasteis = handlers.pasteisLeft ?? null;
  const canGivePastel = pasteis !== null && !isOwn && isApproved && viewerId !== undefined;
  const pastelCount = commit.pasteis_count ?? 0;
  const canReact = isApproved || isOwn;
  const showsReplies = repliesOpen || (withReplies && !hasThread && commit.replies_count > 0);
  const toggleReplies = () => ((expandable && handlers.onToggleReplies) || handlers.onOpen)?.(commit);
  const iconSize = compact ? 14 : 16;
  const labelStyle = compact ? styles.compactLabel : undefined;

  const more = () => {
    const url = commit.html_url ?? `${baseUrl()}/@${commit.author.username}/commits/${commit.id}`;
    const share = () => Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    const remove = () =>
      Alert.alert('Delete this commit?', "There's no undo.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handlers.onDelete?.(commit) },
      ]);

    const report = () => handlers.onReport?.(commit);
    const canReport = !isOwn && isApproved && Boolean(handlers.onReport);

    if (Platform.OS === 'ios') {
      const options = ['Share link', ...(canReport ? ['Report commit'] : []), ...(isOwn ? ['Delete'] : []), 'Cancel'];

      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: isOwn ? options.length - 2 : undefined }, (index) => {
        const picked = options[index];

        if (picked === 'Share link') {
          share();
        } else if (picked === 'Report commit') {
          report();
        } else if (picked === 'Delete') {
          remove();
        }
      });

      return;
    }

    Alert.alert(commit.short_hash ?? '', undefined, [
      { text: 'Share link', onPress: share },
      ...(canReport ? [{ text: 'Report commit', onPress: report }] : []),
      ...(isOwn ? [{ text: 'Delete', style: 'destructive' as const, onPress: remove }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.row}>
      {canReact && (
        <Pressable onPress={() => handlers.onStar?.(commit)} style={styles.action} accessibilityRole="button" accessibilityLabel={commit.starred ? 'Unstar commit' : 'Star commit'}>
          <Star size={iconSize} color={commit.starred ? theme.primary : theme.inkMuted} fill={commit.starred ? theme.primary : 'transparent'} strokeWidth={2} />
          {commit.stars_count > 0 && (
            <Text variant="mono" color={commit.starred ? theme.primary : theme.inkMuted} style={labelStyle}>{commit.stars_count}</Text>
          )}
        </Pressable>
      )}

      {pasteis !== null && (
        <Pressable onPress={canGivePastel ? () => handlers.onPastel?.(commit) : undefined} disabled={!canGivePastel} style={styles.action} accessibilityRole="button" accessibilityLabel={canGivePastel ? `Give a pastel, ${pastelCount} given, ${pasteis} left today` : `${pastelCount} pastéis`}>
          <Image source={require('../assets/images/pastel-de-nata.png')} style={{ width: compact ? 18 : 20, height: compact ? 18 : 20 }} contentFit="contain" />
          <Text variant="mono" muted style={labelStyle}>{pastelCount}</Text>
        </Pressable>
      )}

      {withQuote && canReact && (
        <Pressable onPress={() => handlers.onQuote?.(commit)} style={[styles.action, styles.centered]} accessibilityRole="button" accessibilityLabel="Quote">
          <Quote size={iconSize} color={theme.inkMuted} strokeWidth={2} />
        </Pressable>
      )}

      <Pressable onPress={() => handlers.onReply?.(commit)} style={[styles.action, showsReplies && styles.centered]} accessibilityRole="button" accessibilityLabel="Reply">
        <MessageSquareReply size={iconSize} color={theme.inkMuted} strokeWidth={2} />
        {!showsReplies && <Text variant="small" muted style={[styles.label, labelStyle]}>Reply</Text>}
      </Pressable>

      {showsReplies && (
        <Pressable onPress={toggleReplies} style={styles.action} accessibilityRole="button" accessibilityLabel={repliesOpen ? 'Hide replies' : count(commit.replies_count, 'reply', 'replies')}>
          {repliesOpen ? <ChevronDown size={14} color={theme.primary} strokeWidth={2} /> : <ChevronRight size={14} color={theme.primary} strokeWidth={2} />}
          <Text variant="small" color={theme.primary} style={[styles.label, labelStyle]}>{repliesOpen ? 'Hide replies' : count(commit.replies_count, 'reply', 'replies')}</Text>
        </Pressable>
      )}

      <View style={styles.spacer} />

      <Pressable onPress={more} style={[styles.action, styles.centered]} accessibilityRole="button" accessibilityLabel="More">
        <Ellipsis size={iconSize} color={theme.inkMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginLeft: -8, marginVertical: -6 },
  action: { flexDirection: 'row', alignItems: 'center', minWidth: 44, height: 36, paddingHorizontal: 8, gap: 5 },
  centered: { justifyContent: 'center' },
  label: { fontSize: 13, lineHeight: 18 },
  compactLabel: { fontSize: 12, lineHeight: 16 },
  spacer: { flex: 1 },
});
