import { AtSign, Check, ChevronDown, ChevronRight, MessageSquareReply, Quote, Star, UserPlus, X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { RelativeTime } from '@/components/relative-time';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import type { Notification, User } from '@/lib/types';

export function isModeration(notification: Notification): boolean {
  return notification.type === 'approved' || notification.type === 'rejected';
}

export function isFollow(notification: Notification): boolean {
  return notification.type === 'followed';
}

export function commitToOpen(notification: Notification): string | null {
  return isFollow(notification) ? null : (notification.commit?.id ?? notification.commit_id ?? null);
}

export function groupNoun(notification: Notification): string {
  switch (notification.type) {
    case 'followed':
      return 'followers';
    case 'starred':
      return 'stars';
    default:
      return 'updates';
  }
}

function sentence(notification: Notification): string {
  switch (notification.type) {
    case 'followed':
      return 'followed you';
    case 'mentioned':
      return 'mentioned you';
    case 'starred':
      return 'starred your commit';
    case 'quoted':
      return 'quoted your commit';
    case 'approved':
    case 'rejected':
      return `Your commit was ${notification.type}`;
    default:
      return 'replied to your commit';
  }
}

function others(notification: Notification): string {
  const count = notification.type === 'followed' || notification.type === 'starred' ? Math.max(notification.actors_count ?? 1, notification.actors?.length ?? 1) - 1 : 0;

  return count < 1 ? '' : `and ${count} ${count === 1 ? 'other' : 'others'}`;
}

function Icon({ type, color, size = 16, filled = false }: { type: string; color: string; size?: number; filled?: boolean }) {
  switch (type) {
    case 'followed':
      return <UserPlus size={size} color={color} strokeWidth={2} />;
    case 'quoted':
      return <Quote size={size} color={color} strokeWidth={2} />;
    case 'starred':
      return <Star size={size} color={color} strokeWidth={2} fill={filled ? color : 'transparent'} />;
    case 'mentioned':
      return <AtSign size={size} color={color} strokeWidth={2} />;
    case 'approved':
      return <Check size={size} color={color} strokeWidth={2} />;
    case 'rejected':
      return <X size={size} color={color} strokeWidth={2} />;
    default:
      return <MessageSquareReply size={size} color={color} strokeWidth={2} />;
  }
}

export const NotificationRow = memo(function NotificationRow({
  notification,
  isNew,
  hasPrevious,
  open,
  group,
  onPress,
  onToggleGroup,
  onOpenItem,
  onLoadOlder,
  onOpenActor,
}: {
  notification: Notification;
  isNew: boolean;
  hasPrevious: boolean;
  open: boolean;
  group?: { items: Notification[]; hasMore: boolean; failed: boolean } | null;
  onPress: (notification: Notification) => void;
  onToggleGroup: (notification: Notification) => void;
  onOpenItem: (notification: Notification) => void;
  onLoadOlder: (notification: Notification) => void;
  /** The avatars and names open the person; the rest of the row opens the commit. */
  onOpenActor?: (user: User) => void;
}) {
  const theme = useTheme();
  const moderation = isModeration(notification);
  const rejection = notification.type === 'rejected';
  const actors = notification.actors && notification.actors.length > 0 ? notification.actors : [notification.actor];
  const more = Math.max(0, (notification.actors_count ?? actors.length) - Math.min(actors.length, 3));
  const lane = moderation ? theme.inkMuted : laneColor(theme, notification.actor?.lane);
  const grouped = (notification.event_count ?? 1) > 1;
  const noun = groupNoun(notification);
  const body = notification.commit?.body ?? null;
  const aboutYourCommit = notification.type === 'starred' || moderation;
  const rest = others(notification);

  return (
    <Pressable onPress={() => onPress(notification)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.wash : theme.surface }]} accessibilityRole="button" accessibilityLabel={`${isNew ? 'New. ' : ''}${moderation ? '' : `${notification.actor?.name ?? ''} `}${sentence(notification)}`}>
      <View style={styles.content}>
        <View style={styles.head}>
          {moderation ? (
            <View style={[styles.verdict, { backgroundColor: rejection ? theme.destructiveSoft : theme.wash }]}>
              <Text variant="mono" color={rejection ? theme.destructive : theme.inkMuted} style={styles.tiny}>{notification.type}</Text>
            </View>
          ) : (
            <View style={styles.avatars}>
              {actors.slice(0, 3).map((actor, index) => (
                <Pressable key={`${actor.id}-${index}`} onPress={onOpenActor ? () => onOpenActor(actor) : undefined} hitSlop={4} style={[styles.stacked, index > 0 && styles.overlap, { borderColor: theme.surface }]} accessibilityRole="button" accessibilityLabel={`@${actor.handle}`}>
                  <Avatar user={actor} size={32} />
                </Pressable>
              ))}
              {more > 0 && (
                <View style={[styles.stacked, styles.overlap, styles.moreDisc, { borderColor: theme.surface, backgroundColor: theme.wash }]}>
                  <Text variant="mono" muted style={styles.tiny}>+{more}</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.spacer} />
          <RelativeTime iso={notification.created_at} />
          {isFollow(notification) && typeof notification.actor?.is_followed === 'boolean' && <FollowButton username={notification.actor.handle} isFollowing={notification.actor.is_followed} />}
        </View>

        {moderation ? (
          <Text>{sentence(notification)}.</Text>
        ) : (
          <Text>
            <Text variant="name" onPress={onOpenActor && notification.actor ? () => onOpenActor(notification.actor) : undefined} accessibilityRole="link">{notification.actor?.name || notification.actor?.handle}</Text>{' '}
            {rest === '' ? (
              <>
                <Text variant="mono" muted onPress={onOpenActor && notification.actor ? () => onOpenActor(notification.actor) : undefined} accessibilityRole="link">@{notification.actor?.handle}</Text> {sentence(notification)}
              </>
            ) : (
              `${rest} ${sentence(notification)}`
            )}
          </Text>
        )}

        {body !== null && !isFollow(notification) && (
          aboutYourCommit ? (
            <View style={[styles.yourCommit, { borderColor: theme.hairline }]}>
              <Text muted numberOfLines={3}>{body}</Text>
            </View>
          ) : (
            <Text numberOfLines={6}>{body}</Text>
          )
        )}

        {rejection && (
          <View style={styles.rejection}>
            {notification.reason ? (
              <Text variant="small">
                <Text variant="mono" muted>reason: </Text>
                {notification.reason}
              </Text>
            ) : null}
            <Text variant="small" muted>Only you can see this update and your rejected commit.</Text>
          </View>
        )}

        {grouped && (
          <Pressable onPress={() => onToggleGroup(notification)} style={styles.toggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={open ? `Hide ${noun}` : `${notification.event_count} ${noun}`}>
            {open ? <ChevronDown size={14} color={theme.primary} strokeWidth={2} /> : <ChevronRight size={14} color={theme.primary} strokeWidth={2} />}
            <Text variant="small" color={theme.primary} style={styles.toggleText}>{open ? `Hide ${noun}` : `${notification.event_count} ${noun}`}</Text>
          </Pressable>
        )}

        {open && (
          <View style={styles.group}>
            {(group?.items ?? []).map((item) => (
              <Pressable key={item.id} onPress={() => onOpenItem(item)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.wash }]} accessibilityRole="button">
                <Pressable onPress={onOpenActor && item.actor ? () => onOpenActor(item.actor) : undefined} hitSlop={4} accessibilityRole="button" accessibilityLabel={`@${item.actor?.handle ?? ''}`}>
                  <Avatar user={item.actor} size={28} />
                </Pressable>
                <View style={styles.itemColumn}>
                  <View style={styles.itemHead}>
                    <Text variant="name" numberOfLines={1} style={styles.shrink} onPress={onOpenActor && item.actor ? () => onOpenActor(item.actor) : undefined} accessibilityRole="link">{item.actor?.name || item.actor?.handle}</Text>
                    <View style={styles.spacer} />
                    <Icon type={item.type} color={isModeration(item) ? theme.inkMuted : laneColor(theme, item.actor?.lane)} filled={item.type === 'starred'} />
                    <RelativeTime iso={item.created_at} />
                    {isFollow(item) && typeof item.actor?.is_followed === 'boolean' && <FollowButton username={item.actor.handle} isFollowing={item.actor.is_followed} />}
                  </View>
                  {item.commit?.body && item.type !== 'starred' && !isFollow(item) ? <Text numberOfLines={6}>{item.commit.body}</Text> : null}
                </View>
              </Pressable>
            ))}
            {group?.failed && (
              <View style={styles.failed}>
                <Text variant="mono" muted>fatal: could not load {noun}</Text>
                <Pressable onPress={() => onLoadOlder(notification)} hitSlop={12} accessibilityRole="button">
                  <Text variant="small" color={theme.primary}>Try again</Text>
                </Pressable>
              </View>
            )}
            {!group && (
              <View style={styles.failed}>
                <Text variant="mono" muted>loading {noun}…</Text>
              </View>
            )}
            {group?.hasMore && (
              <Pressable onPress={() => onLoadOlder(notification)} style={styles.older} hitSlop={8} accessibilityRole="button">
                <Text variant="small" color={theme.primary} style={styles.toggleText}>Show older {noun}</Text>
              </Pressable>
            )}
            <View style={[styles.guide, { backgroundColor: theme.rail }]} />
          </View>
        )}
      </View>
      <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />

      {hasPrevious && <View style={[styles.railTop, { backgroundColor: theme.rail }]} />}
      <View style={[styles.railBottom, { backgroundColor: theme.rail }]} />
      <View style={[styles.node, { borderColor: isNew ? theme.primary : theme.rail, backgroundColor: theme.surface }]}>
        <Icon type={notification.type} color={lane} filled={notification.type === 'starred'} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { width: '100%' },
  content: { marginLeft: Space.rail, paddingVertical: 12, paddingRight: Space.gutter, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  stacked: { borderWidth: 2, borderRadius: Radius.full },
  overlap: { marginLeft: -10 },
  moreDisc: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  verdict: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  spacer: { flex: 1 },
  tiny: { fontSize: 12, lineHeight: 16 },
  yourCommit: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1 },
  rejection: { marginTop: 4, gap: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: -2, paddingVertical: 4, minHeight: 28 },
  toggleText: { fontSize: 13, lineHeight: 18 },
  group: { marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, paddingLeft: 32, paddingRight: 8, borderRadius: Radius.lg, borderCurve: 'continuous' },
  itemColumn: { flex: 1, gap: 4 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  shrink: { flexShrink: 1 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 32 },
  older: { marginLeft: 24, marginTop: 4, paddingVertical: 4, minHeight: 28, justifyContent: 'center' },
  guide: { position: 'absolute', top: 0, bottom: 8, left: 14, width: 1 },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: Space.rail },
  railTop: { position: 'absolute', top: 0, left: Space.rail / 2 - 1, width: 2, height: 32 },
  railBottom: { position: 'absolute', top: 32, bottom: 0, left: Space.rail / 2 - 1, width: 2 },
  node: { position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
