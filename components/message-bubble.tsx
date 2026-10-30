import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CornerUpLeft } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { viewerParams } from '@/lib/viewer';
import { Avatar } from '@/components/avatar';
import { CommitBody } from '@/components/commit-body';
import { Text } from '@/components/text';
import { VoiceNote } from '@/components/voice-note';
import { Radius, Space, useTheme } from '@/constants/theme';
import { openLink } from '@/lib/links';
import { eventText, messageGist, reactionChips } from '@/lib/remotes';
import type { LinkPreview, Message, MessageImage, MessageReply, User } from '@/lib/types';
import type { PendingMessage } from '@/lib/use-thread';

const MaxBubble = 0.78;

function timeOf(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function EventLine({ message, me }: { message: Message; me: User | null | undefined }) {
  return (
    <View style={styles.event}>
      <Text variant="mono" muted numberOfLines={2} style={styles.eventText}>* {eventText(message, me)}</Text>
    </View>
  );
}

/** The message being answered, as much of it as its ghost shows. */
export function ReplyGhost({ reply, authors, onPress, tint, compact = false }: { reply: MessageReply; authors: Map<string, User>; onPress?: () => void; tint: string; compact?: boolean }) {
  const theme = useTheme();
  const author = authors.get(String(reply.user_id));
  const gist = messageGist({ body: reply.body, images_count: reply.images_count, has_voice: reply.has_voice ?? false }) || 'Message';

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.ghost, { borderLeftColor: tint }, compact && styles.ghostCompact]}>
      <Text variant="mono" numberOfLines={1} style={[styles.ghostName, { color: tint }]}>{author ? `@${author.handle}` : 'message'}</Text>
      <Text variant="small" numberOfLines={compact ? 1 : 2} color={theme.inkMuted} style={styles.ghostBody}>{gist}</Text>
    </Pressable>
  );
}

function Images({ images, width }: { images: MessageImage[]; width: number }) {
  const theme = useTheme();
  const router = useRouter();
  const shown = images.filter((image) => typeof image.url === 'string' && image.url !== '').slice(0, 3);
  const view = (image: MessageImage) => router.push({ pathname: '/image', params: viewerParams(shown.map((candidate) => ({ url: candidate.url, alt: candidate.description })), shown.indexOf(image)) });

  if (shown.length === 0) {
    return null;
  }

  if (shown.length === 1) {
    const [image] = shown;
    const height = Math.min(320, image.width && image.height ? (width * image.height) / image.width : 200);

    return (
      <Pressable onPress={() => view(image)} accessibilityRole="imagebutton" accessibilityLabel={image.description ?? 'Image'}>
        <Image source={{ uri: image.url }} style={{ width, height, borderRadius: Radius.lg, backgroundColor: theme.wash }} contentFit="cover" cachePolicy="disk" recyclingKey={image.url} transition={0} />
      </Pressable>
    );
  }

  const side = (width - 4 * (shown.length - 1)) / shown.length;

  return (
    <View style={styles.grid}>
      {shown.map((image) => (
        <Pressable key={image.id} onPress={() => view(image)} accessibilityRole="imagebutton" accessibilityLabel={image.description ?? 'Image'}>
          <Image source={{ uri: image.url }} style={{ width: side, height: side, borderRadius: Radius.lg, backgroundColor: theme.wash }} contentFit="cover" cachePolicy="disk" recyclingKey={image.url} transition={0} />
        </Pressable>
      ))}
    </View>
  );
}

function LinkCard({ preview, width }: { preview: LinkPreview; width: number }) {
  const theme = useTheme();
  const host = preview.url.replace(/^https?:\/\//, '').split('/')[0];

  return (
    <Pressable onPress={() => openLink(preview.url)} style={[styles.card, { width, borderColor: theme.hairline, backgroundColor: theme.surface }]} accessibilityRole="link">
      {preview.image_url ? <Image source={{ uri: preview.image_url }} recyclingKey={preview.image_url} style={[styles.cardImage, { backgroundColor: theme.wash }]} contentFit="cover" cachePolicy="disk" transition={0} /> : null}
      <View style={styles.cardText}>
        <Text variant="mono" muted numberOfLines={1} style={styles.tiny}>{preview.site_name || host}</Text>
        {preview.title ? <Text variant="label" numberOfLines={2}>{preview.title}</Text> : null}
        {preview.description ? <Text variant="small" muted numberOfLines={2}>{preview.description}</Text> : null}
      </View>
    </Pressable>
  );
}

export type BubbleHandlers = {
  onLongPress?: (message: Message) => void;
  onToggleReaction?: (message: Message, emoji: string) => void;
  /** Two quick taps on the bubble, which toggle a heart on the web. */
  onDoubleTap?: (message: Message) => void;
  /** A sideways swipe toward the middle of the screen, which replies on the web's touch screens. */
  onSwipeReply?: (message: Message) => void;
  onOpenReply?: (id: number) => void;
  onOpenAuthor?: (user: User) => void;
};

const DoubleTapWithin = 300;
const SwipeToReply = 56;
const SwipeStart = 12;

/**
 * Slides the bubble as the finger drags it sideways, on the UI thread, and
 * calls back once it has gone far enough. The offset is reset when the
 * recycled row shows another message; Reduce Motion snaps instead of springing.
 */
function useSwipeToReply(mine: boolean, messageId: number | string, onSwipe: (() => void) | undefined) {
  const offset = useSharedValue(0);
  const fired = useSharedValue(false);
  const velocity = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const latest = useRef(onSwipe);
  const direction = mine ? -1 : 1;

  useEffect(() => {
    latest.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    offset.set(0);
    fired.set(false);
  }, [messageId, offset, fired]);

  const fire = useCallback(() => latest.current?.(), []);

  const pan = usePanGesture({
    enabled: onSwipe !== undefined,
    // Only a clearly sideways drag toward the middle of the screen; the list keeps vertical scrolls.
    activeOffsetX: SwipeStart * direction,
    failOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      fired.set(false);
    },
    onUpdate: (event) => {
      'worklet';
      velocity.set(event.velocityX);
      const along = Math.max(0, event.translationX * direction);
      offset.set(Math.min(along, SwipeToReply + (along - SwipeToReply) / 4) * direction);

      if (!fired.get() && along >= SwipeToReply) {
        fired.set(true);
        runOnJS(fire)();
      }
    },
    onFinalize: () => {
      'worklet';
      offset.set(reduceMotion ? 0 : withSpring(0, { damping: 18, stiffness: 220, velocity: velocity.get() }));
    },
  });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return { pan, style };
}

/**
 * One message: the writer's own on the right in their color, everyone else's
 * on the left. In an org, a message that opens a run shows who wrote it.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  me,
  mine,
  authors,
  showsAuthor,
  pulled = false,
  handlers,
}: {
  message: Message;
  me: User | null | undefined;
  mine: boolean;
  authors: Map<string, User>;
  showsAuthor: boolean;
  /** Direct threads: the partner has pulled through this message. */
  pulled?: boolean;
  handlers: BubbleHandlers;
}) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const bubbleWidth = Math.floor(screen * MaxBubble) - 24;
  const author = message.user ?? authors.get(String(message.user_id));
  const chips = reactionChips(message.reactions, me);
  const inkOnBubble = mine ? theme.primaryInk : theme.ink;
  const hasBody = message.body.trim() !== '';
  const hasMedia = (message.images?.length ?? 0) > 0;
  const lastTap = useRef(0);
  const swipe = useSwipeToReply(mine, message.id, handlers.onSwipeReply ? () => handlers.onSwipeReply?.(message) : undefined);

  const tapped = () => {
    const now = Date.now();

    if (handlers.onDoubleTap && now - lastTap.current < DoubleTapWithin) {
      lastTap.current = 0;
      handlers.onDoubleTap(message);
    } else {
      lastTap.current = now;
    }
  };

  return (
    <GestureDetector gesture={swipe.pan}>
    <Animated.View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapTheirs, swipe.style]}>
      {showsAuthor && !mine && author && (
        <Pressable onPress={handlers.onOpenAuthor ? () => handlers.onOpenAuthor?.(author) : undefined} style={styles.author} hitSlop={6}>
          <Avatar user={author} size={20} />
          <Text variant="mono" muted style={styles.tiny}>@{author.handle}</Text>
        </Pressable>
      )}

      <Pressable
        onPress={handlers.onDoubleTap ? tapped : undefined}
        onLongPress={handlers.onLongPress ? () => handlers.onLongPress?.(message) : undefined}
        delayLongPress={300}
        style={({ pressed }) => [styles.bubble, { maxWidth: bubbleWidth + 24, backgroundColor: mine ? theme.primary : theme.wash }, mine ? styles.bubbleMine : styles.bubbleTheirs, pressed && styles.pressed]}
        accessibilityLabel={`${mine ? 'You' : author ? `@${author.handle}` : 'Message'}: ${messageGist(message)}, ${timeOf(message.created_at)}`}
        accessibilityHint={handlers.onDoubleTap ? 'Long press for reactions and reply, double tap for a heart' : 'Long press for reactions and reply'}>
        {message.reply_to && <ReplyGhost reply={message.reply_to} authors={authors} tint={mine ? theme.primaryInk : theme.primary} onPress={handlers.onOpenReply ? () => handlers.onOpenReply?.(message.reply_to!.id) : undefined} />}
        {hasMedia && <Images images={message.images!} width={Math.min(bubbleWidth, 280)} />}
        {message.voice && <VoiceNote voice={message.voice} tint={inkOnBubble} />}
        {hasBody ? (
          mine ? (
            <Text selectable color={theme.primaryInk} style={styles.bodyMine}>{message.body}</Text>
          ) : (
            <CommitBody body={message.body} segments={message.body_segments} size={15} onOpenLink={openLink} onOpenMention={handlers.onOpenAuthor ? (username) => handlers.onOpenAuthor?.({ handle: username } as User) : undefined} />
          )
        ) : !hasMedia && !message.voice ? (
          <Text variant="small" color={inkOnBubble} style={styles.voice}>Voice note · listen on dev-null.sh</Text>
        ) : null}
        {message.link_preview?.url && !message.link_preview.is_pending ? <LinkCard preview={message.link_preview} width={Math.min(bubbleWidth, 280)} /> : null}
        <View style={styles.meta}>
          <Text variant="mono" color={inkOnBubble} style={[styles.time, mine && styles.timeMine]}>{timeOf(message.created_at)}</Text>
          {mine && pulled && <Text variant="mono" color={theme.primaryInk} style={[styles.time, styles.timeMine]}>· pulled</Text>}
        </View>
      </Pressable>

      {chips.length > 0 && (
        <View style={[styles.chips, mine ? styles.chipsMine : styles.chipsTheirs]}>
          {chips.map((chip) => (
            <Pressable
              key={chip.emoji}
              onPress={handlers.onToggleReaction ? () => handlers.onToggleReaction?.(message, chip.emoji) : undefined}
              style={[styles.chip, { borderColor: chip.mine ? theme.primary : theme.hairline, backgroundColor: chip.mine ? theme.primarySoft : theme.surface }]}
              accessibilityRole="button"
              accessibilityLabel={`${chip.emoji} ${chip.count}${chip.mine ? ', including you' : ''}`}>
              <Text style={styles.chipEmoji}>{chip.emoji}</Text>
              <Text variant="mono" color={chip.mine ? theme.primary : theme.inkMuted} style={styles.tiny}>{chip.count}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Animated.View>
    </GestureDetector>
  );
});

/** A message not yet accepted by the server: dim while staged, with a way back when rejected. */
export function PendingBubble({ message, authors, onRetry, onDiscard }: { message: PendingMessage; authors: Map<string, User>; onRetry: (clientId: string) => void; onDiscard: (clientId: string) => void }) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const bubbleWidth = Math.floor(screen * MaxBubble) - 24;
  const rejected = message.status === 'rejected';

  return (
    <View style={[styles.wrap, styles.wrapMine]}>
      <View style={[styles.bubble, styles.bubbleMine, { maxWidth: bubbleWidth + 24, backgroundColor: theme.primary, opacity: rejected ? 0.55 : 0.75 }]}>
        {message.reply_to && <ReplyGhost reply={message.reply_to} authors={authors} tint={theme.primaryInk} />}
        {message.images.length > 0 && (
          <View style={styles.grid}>
            {message.images.map((image) => (
              <Image key={image.id} source={{ uri: image.uri }} style={{ width: 96, height: 96, borderRadius: Radius.lg }} contentFit="cover" />
            ))}
          </View>
        )}
        {message.voice && <VoiceNote voice={message.voice} tint={theme.primaryInk} />}
        {message.body !== '' && <Text color={theme.primaryInk} style={styles.bodyMine}>{message.body}</Text>}
        <View style={styles.meta}>
          {rejected ? (
            <Text variant="mono" color={theme.primaryInk} style={[styles.time, styles.timeMine]}>not pushed</Text>
          ) : (
            <ActivityIndicator size="small" color={theme.primaryInk} style={styles.spinner} />
          )}
        </View>
      </View>
      {rejected && (
        <View style={styles.rejected}>
          <Text variant="mono" color={theme.destructive} numberOfLines={2} style={[styles.tiny, styles.reason]}>{message.error ?? 'fatal: could not push.'}</Text>
          <Pressable onPress={() => onRetry(message.client_id)} hitSlop={8} accessibilityRole="button">
            <Text variant="mono" color={theme.primary} style={styles.tiny}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => onDiscard(message.client_id)} hitSlop={8} accessibilityRole="button">
            <Text variant="mono" muted style={styles.tiny}>Discard</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function ReplyIcon({ color }: { color: string }) {
  return <CornerUpLeft size={14} color={color} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Space.gutter, paddingVertical: 2, gap: 4 },
  wrapMine: { alignItems: 'flex-end' },
  wrapTheirs: { alignItems: 'flex-start' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 2, marginLeft: 2 },
  bubble: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 18, gap: 6 },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  pressed: { opacity: 0.8 },
  bodyMine: { fontSize: 15, lineHeight: 22 },
  voice: { fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 4, marginTop: -2 },
  time: { fontSize: 10, lineHeight: 14, opacity: 0.6 },
  timeMine: { opacity: 0.8 },
  spinner: { transform: [{ scale: 0.6 }], height: 14 },
  ghost: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 2, gap: 0, opacity: 0.9 },
  ghostCompact: { flex: 1 },
  ghostName: { fontSize: 11, lineHeight: 14 },
  ghostBody: { fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  card: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  cardImage: { width: '100%', height: 120 },
  cardText: { padding: 10, gap: 2 },
  tiny: { fontSize: 12, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -2 },
  chipsMine: { justifyContent: 'flex-end' },
  chipsTheirs: { justifyContent: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: Radius.full, borderWidth: 1 },
  chipEmoji: { fontSize: 13, lineHeight: 18 },
  event: { alignItems: 'center', paddingHorizontal: Space.gutterWide, paddingVertical: 8 },
  eventText: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  rejected: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 4, maxWidth: '90%' },
  reason: { flexShrink: 1 },
});
