import { ChevronDown, ChevronRight, Ellipsis, MessageSquareReply, Quote, Star } from 'lucide-react-native';
import { Image } from 'expo-image';
import { type ReactNode, useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  onPin?: (commit: Commit) => void;
  /** Opens the commit as an image to share. */
  onCard?: (commit: Commit) => void;
  onOpenAuthor?: (user: User) => void;
  /** Feed only: toggles the reply thread in place. */
  onToggleReplies?: (commit: Commit) => void;
  onReport?: (commit: Commit) => void;
  onPastel?: (commit: Commit) => void;
  onVote?: (commit: Commit, optionId: string) => void;
  /** Pastéis left today, or null when the mode is off. */
  pasteisLeft?: number | null;
};

/** Every control in the row is at least 44pt tall and 48pt wide: a thumb target, not a pointer target. */
export const ActionHeight = 44;

// Each action is a sibling of the row's own press area, never nested in it, so
// a tap near the icon can only hit the action or nothing: it never opens the commit.
export function Action({ onPress, disabled = false, label, centered = false, children }: { onPress?: () => void; disabled?: boolean; label: string; centered?: boolean; children: ReactNode }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: theme.wash, borderless: true, radius: 24 }}
      hitSlop={{ top: 2, bottom: 2 }}
      style={({ pressed }) => [styles.action, centered && styles.centered, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

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
  const insets = useSafeAreaInsets();
  // Android's Alert shows three buttons at most, so More opens a sheet of its own there.
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const isOwn = viewerId !== undefined && String(commit.author?.id) === String(viewerId);
  const isApproved = commit.status === 'approved' || commit.status === '';
  const pasteis = handlers.pasteisLeft ?? null;
  const canGivePastel = pasteis !== null && !isOwn && isApproved && viewerId !== undefined;
  const pastelCount = commit.pasteis_count ?? 0;
  const canReact = isApproved || isOwn;
  const showsReplies = repliesOpen || (withReplies && !hasThread && commit.replies_count > 0);
  const toggleReplies = () => ((expandable && handlers.onToggleReplies) || handlers.onOpen)?.(commit);
  const iconSize = compact ? 16 : 18;
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
    // Only the user's own top-level commits can be pinned, as on the web's More menu.
    const pinLabel = commit.is_pinned ? 'Unpin from profile' : 'Pin to profile';
    const canPin = isOwn && !commit.parent_id && Boolean(handlers.onPin);
    const togglePin = () => handlers.onPin?.(commit);
    const canCard = isApproved && Boolean(handlers.onCard);
    const card = () => handlers.onCard?.(commit);

    if (Platform.OS === 'ios') {
      const options = ['Share link', ...(canCard ? ['Share as image'] : []), ...(canPin ? [pinLabel] : []), ...(canReport ? ['Report commit'] : []), ...(isOwn ? ['Delete'] : []), 'Cancel'];

      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: isOwn ? options.length - 2 : undefined }, (index) => {
        const picked = options[index];

        if (picked === 'Share link') {
          share();
        } else if (picked === 'Share as image') {
          card();
        } else if (picked === pinLabel) {
          togglePin();
        } else if (picked === 'Report commit') {
          report();
        } else if (picked === 'Delete') {
          remove();
        }
      });

      return;
    }

    setMenu([
      { label: 'Share link', run: share },
      ...(canCard ? [{ label: 'Share as image', run: card }] : []),
      ...(canPin ? [{ label: pinLabel, run: togglePin }] : []),
      ...(canReport ? [{ label: 'Report commit', run: report }] : []),
      ...(isOwn ? [{ label: 'Delete', run: remove, destructive: true }] : []),
    ]);
  };

  return (
    <View style={styles.row}>
      {canReact && (
        <Action onPress={() => handlers.onStar?.(commit)} label={commit.starred ? 'Unstar commit' : 'Star commit'}>
          <Star size={iconSize} color={commit.starred ? theme.primary : theme.inkMuted} fill={commit.starred ? theme.primary : 'transparent'} strokeWidth={2} />
          {commit.stars_count > 0 && (
            <Text variant="mono" color={commit.starred ? theme.primary : theme.inkMuted} style={labelStyle}>{commit.stars_count}</Text>
          )}
        </Action>
      )}

      {pasteis !== null && (
        <Action onPress={canGivePastel ? () => handlers.onPastel?.(commit) : undefined} label={canGivePastel ? `Give a pastel, ${pastelCount} given, ${pasteis} left today` : `${pastelCount} pastéis`}>
          <Image source={require('../assets/images/pastel-de-nata.png')} style={{ width: compact ? 18 : 20, height: compact ? 18 : 20 }} contentFit="contain" />
          <Text variant="mono" muted style={labelStyle}>{pastelCount}</Text>
        </Action>
      )}

      {withQuote && canReact && (
        <Action onPress={() => handlers.onQuote?.(commit)} label="Quote" centered>
          <Quote size={iconSize} color={theme.inkMuted} strokeWidth={2} />
        </Action>
      )}

      <Action onPress={() => handlers.onReply?.(commit)} label="Reply" centered={showsReplies}>
        <MessageSquareReply size={iconSize} color={theme.inkMuted} strokeWidth={2} />
        {!showsReplies && <Text variant="small" muted style={[styles.label, labelStyle]}>Reply</Text>}
      </Action>

      {showsReplies && (
        <Action onPress={toggleReplies} label={repliesOpen ? 'Hide replies' : count(commit.replies_count, 'reply', 'replies')}>
          {repliesOpen ? <ChevronDown size={16} color={theme.primary} strokeWidth={2} /> : <ChevronRight size={16} color={theme.primary} strokeWidth={2} />}
          <Text variant="small" color={theme.primary} style={[styles.label, labelStyle]}>{repliesOpen ? 'Hide replies' : count(commit.replies_count, 'reply', 'replies')}</Text>
        </Action>
      )}

      <View style={styles.spacer} />

      <Action onPress={more} label="More" centered>
        <Ellipsis size={iconSize} color={theme.inkMuted} strokeWidth={2} />
      </Action>

      {Platform.OS !== 'ios' && (
        <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={() => setMenu(null)} statusBarTranslucent>
          <Pressable onPress={() => setMenu(null)} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close">
            <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Text variant="mono" muted style={styles.sheetTitle}>{commit.short_hash || ''}</Text>
              {(menu ?? []).map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    setMenu(null);
                    item.run();
                  }}
                  style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: theme.wash }]}
                  accessibilityRole="button">
                  <Text color={item.destructive ? theme.destructive : theme.ink}>{item.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setMenu(null)} style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: theme.wash }]} accessibilityRole="button">
                <Text muted>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

type MenuItem = { label: string; run: () => void; destructive?: boolean };

const styles = StyleSheet.create({
  // Pulled left so the first icon lines up with the text above, and up into
  // the gap so the row reads as tight as before while the targets stay 44pt.
  row: { flexDirection: 'row', alignItems: 'center', marginLeft: -12, marginTop: -8, marginBottom: -6, gap: 4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  sheetTitle: { paddingHorizontal: 20, paddingVertical: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 14 },
  action: { flexDirection: 'row', alignItems: 'center', minWidth: 48, height: ActionHeight, paddingHorizontal: 12, gap: 6, borderRadius: 22 },
  centered: { justifyContent: 'center' },
  pressed: { opacity: 0.45 },
  label: { fontSize: 13, lineHeight: 18 },
  compactLabel: { fontSize: 12, lineHeight: 16 },
  spacer: { flex: 1 },
});
