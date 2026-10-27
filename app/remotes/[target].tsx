import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Ellipsis, ImagePlus, SendHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { AttachmentStrip, chooseImageSource, ToolbarButton, useAttachments } from '@/components/composer';
import { OrgAvatar } from '@/components/conversation-row';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { MentionSuggestions } from '@/components/mention-suggestions';
import { MessageActions } from '@/components/message-actions';
import { EventLine, MessageBubble, PendingBubble, ReplyGhost } from '@/components/message-bubble';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, Unauthenticated } from '@/lib/client';
import { dayKey, dayLabel } from '@/lib/display';
import { tap } from '@/lib/haptics';
import { MaxImages } from '@/lib/images';
import { useKeyboardShown } from '@/lib/keyboard';
import { insertMention, mentionBeforeCaret, useMentionSuggestions } from '@/lib/mentions';
import { useNow } from '@/lib/now';
import { accessNotice, isMine, orgTitle, quickReactions, targetFromParam, targetKey, typingText } from '@/lib/remotes';
import { bumpRemotesUnread, removeFromInbox } from '@/lib/remotes-cache';
import { toast } from '@/lib/toast';
import { type Message, MessageMaxLength, type MessageReply, type OrgMember, type User } from '@/lib/types';
import { type PendingMessage, useThread } from '@/lib/use-thread';

type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'head'; key: string; count: number }
  | { type: 'event'; key: string; message: Message }
  | { type: 'message'; key: string; message: Message; mine: boolean; showsAuthor: boolean; pulled: boolean }
  | { type: 'pending'; key: string; message: PendingMessage };

/** Where you left off: above the first message from someone else since you last pulled, as the web's HEAD line. */
function HeadLine({ count }: { count: number }) {
  const theme = useTheme();

  return (
    <View style={styles.head} accessibilityLabel={`${count} new ${count === 1 ? 'message' : 'messages'} below`}>
      <View style={[styles.headRule, { backgroundColor: theme.primary }]} />
      <Text variant="mono" color={theme.primary} style={styles.dayText}>HEAD · {count > 99 ? '99+' : count} new</Text>
      <View style={[styles.headRule, { backgroundColor: theme.primary }]} />
    </View>
  );
}

function DayLine({ label }: { label: string }) {
  return (
    <View style={styles.day}>
      <Text variant="mono" muted style={styles.dayText}>{label}</Text>
    </View>
  );
}

export default function ThreadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const keyboardShown = useKeyboardShown();
  const now = useNow();
  const { target: param } = useLocalSearchParams<{ target: string }>();
  const target = useMemo(() => targetFromParam(param ?? ''), [param]);
  const key = targetKey(target);
  const me = account.user;
  const thread = useThread(target, focused);
  const data = thread.thread;
  const usage = useQuery({ queryKey: ['reaction-usage'], queryFn: () => api.reactionUsage(), staleTime: 5 * 60_000, enabled: account.status === 'signed-in' });
  const list = useRef<FlashListRef<Row>>(null);
  const attachments = useAttachments();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<MessageReply | null>(null);
  const [acting, setActing] = useState<Message | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  useEffect(() => {
    if (selection) {
      const timer = setTimeout(() => setSelection(undefined), 50);

      return () => clearTimeout(timer);
    }
  }, [selection]);

  useEffect(() => {
    if (thread.error instanceof Unauthenticated) {
      account.signOut().then(() => router.replace('/onboarding'));
    }
  }, [thread.error, account, router]);

  const partner = data?.kind === 'direct' ? data.partner : null;
  const members = useMemo<OrgMember[]>(() => (data?.kind === 'org' ? data.members : []), [data]);
  const access = data?.access ?? 'open';
  const open = access === 'open';
  const archived = data?.is_archived ?? false;
  const title = data ? (data.kind === 'direct' ? data.partner.name || `@${data.partner.handle}` : orgTitle(data.org.name, data.members, me)) : target.kind === 'direct' ? `@${target.handle}` : 'Org';
  const subtitle = data?.kind === 'direct' ? `@${data.partner.handle}` : data?.kind === 'org' ? `${data.members.length} ${data.members.length === 1 ? 'member' : 'members'}` : '';
  const typing = data ? (data.kind === 'org' ? typingText(data.typing) : data.partner_typing ? `@${data.partner.handle} is typing…` : null) : null;

  // An org suggests its members; a direct thread only the partner.
  const mentionable = useMemo(() => (data?.kind === 'org' ? data.members.map((member) => member.user) : partner ? [partner] : []), [data, partner]);
  const mention = mentionBeforeCaret(body, caret);
  const suggestions = useMentionSuggestions(mention, { members: mentionable });

  const pickMention = (user: User) => {
    if (!mention) {
      return;
    }

    const next = insertMention(body, mention, user.handle);
    setBody(next.text);
    setCaret(next.caret);
    setSelection({ start: next.caret, end: next.caret });
  };

  const authors = useMemo(() => {
    const map = new Map<string, User>();

    if (me) {
      map.set(String(me.id), me);
    }

    if (partner) {
      map.set(String(partner.id), partner);
    }

    members.forEach((member) => map.set(String(member.user.id), member.user));
    data?.messages.forEach((message) => {
      if (message.user) {
        map.set(String(message.user.id), message.user);
      }
    });

    return map;
  }, [me, partner, members, data?.messages]);

  // Where you had pulled to, and the latest message, when the thread opened: HEAD stays put while you read.
  const [head, setHead] = useState<{ through: number; until: number } | null>(null);

  useEffect(() => {
    if (head === null && data) {
      // Noted once from the first page, so a later pull does not move the marker.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHead({ through: data.read_through_id, until: data.messages.at(-1)?.id ?? 0 });
    }
  }, [head, data]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let previousDay: string | null = null;
    let previousAuthor: string | null = null;
    const partnerRead = data?.kind === 'direct' ? data.partner_read_through_id : 0;
    const lastMine = [...(data?.messages ?? [])].reverse().find((message) => !message.event && isMine(message, me));
    const marker = head;
    const unread = marker ? (data?.messages ?? []).filter((message) => message.id > marker.through && message.id <= marker.until && !message.event && !isMine(message, me)) : [];
    // As on the web, HEAD only shows when you had read something above it.
    const headAt = unread.length > 0 && data?.messages[0]?.id !== unread[0].id ? unread[0].id : null;

    for (const message of data?.messages ?? []) {
      const day = dayKey(message.created_at);

      if (day !== previousDay) {
        out.push({ type: 'day', key: `day-${day}`, label: dayLabel(message.created_at, now) });
        previousDay = day;
        previousAuthor = null;
      }

      if (message.id === headAt) {
        out.push({ type: 'head', key: 'head', count: unread.length });
        previousAuthor = null;
      }

      if (message.event) {
        out.push({ type: 'event', key: `m-${message.id}`, message });
        previousAuthor = null;
        continue;
      }

      const mine = isMine(message, me);
      out.push({ type: 'message', key: `m-${message.id}`, message, mine, showsAuthor: data?.kind === 'org' && String(message.user_id) !== previousAuthor, pulled: lastMine?.id === message.id && partnerRead >= message.id });
      previousAuthor = String(message.user_id);
    }

    thread.pending.forEach((message) => out.push({ type: 'pending', key: `p-${message.client_id}`, message }));

    return out;
  }, [data, me, now, thread.pending, head]);

  const latestId = data?.messages.at(-1)?.id ?? 0;

  useEffect(() => {
    if (focused && latestId > 0) {
      thread.markRead();
    }
  }, [focused, latestId, thread.markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  const failed = (error: unknown, fallback: string) => Alert.alert(error instanceof ApiError ? error.firstError() : fallback);

  const stash = useMutation({
    mutationFn: () => api.stashRemote(target, !archived),
    onSuccess: () => {
      const stashed = !archived;
      thread.patch((current) => ({ ...current, is_archived: stashed }));
      removeFromInbox(queryClient, key);
      queryClient.invalidateQueries({ queryKey: ['remotes'] });
      toast(stashed ? `Stashed ${title}. It pops back when someone writes.` : `${title} is back in Open.`);
    },
    onError: (error) => failed(error, 'fatal: could not stash.'),
  });

  const merge = useMutation({
    mutationFn: () => api.mergeRequest(target.kind === 'direct' ? target.handle : ''),
    onSuccess: () => {
      thread.patch((current) => ({ ...current, access: 'open' }));
      removeFromInbox(queryClient, key);
      bumpRemotesUnread(queryClient, -1);
      queryClient.invalidateQueries({ queryKey: ['remotes'] });
      toast(`Merged. You can push to @${partner?.handle ?? ''} now.`);
    },
    onError: (error) => failed(error, 'fatal: could not merge the request.'),
  });

  const drop = useMutation({
    mutationFn: () => api.dropRequest(target.kind === 'direct' ? target.handle : ''),
    onSuccess: () => {
      removeFromInbox(queryClient, key);
      bumpRemotesUnread(queryClient, -1);
      queryClient.invalidateQueries({ queryKey: ['remotes'] });
      router.back();
    },
    onError: (error) => failed(error, 'fatal: could not drop the request.'),
  });

  const block = useMutation({
    mutationFn: () => api.block(target.kind === 'direct' ? target.handle : ''),
    onSuccess: () => {
      removeFromInbox(queryClient, key);
      queryClient.invalidateQueries({ queryKey: ['remotes'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    },
    onError: (error) => failed(error, 'fatal: could not block.'),
  });

  const more = () => {
    const options: { label: string; destructive?: boolean; run: () => void }[] = [];

    if (partner) {
      options.push({ label: 'View profile', run: () => router.push({ pathname: '/users/[username]', params: { username: partner.handle } }) });
    } else if (data?.kind === 'org') {
      options.push({ label: 'Members', run: () => setMembersOpen(true) });
    }

    if (data && latestId > 0) {
      options.push({ label: archived ? 'Unstash' : 'Stash', run: () => stash.mutate() });
    }

    if (partner) {
      options.push({
        label: 'Block',
        destructive: true,
        run: () =>
          Alert.alert(`Block @${partner.handle}?`, "You'll stop following each other and this conversation goes away for you. Unblocking doesn't bring back follows.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
          ]),
      });
    }

    if (options.length === 0) {
      return;
    }

    if (Platform.OS === 'ios') {
      const labels = [...options.map((option) => option.label), 'Cancel'];
      const destructive = options.findIndex((option) => option.destructive);

      ActionSheetIOS.showActionSheetWithOptions({ options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructive >= 0 ? destructive : undefined }, (index) => options[index]?.run());

      return;
    }

    Alert.alert(title, undefined, [...options.map((option) => ({ text: option.label, style: option.destructive ? ('destructive' as const) : undefined, onPress: option.run })), { text: 'Cancel', style: 'cancel' }]);
  };

  const canSend = open && !attachments.picking && (body.trim() !== '' || attachments.images.length > 0) && body.length <= MessageMaxLength;

  const send = () => {
    if (!canSend) {
      return;
    }

    tap();
    thread.send(body.trim(), attachments.images, replyTo);
    setBody('');
    setReplyTo(null);
    attachments.clear();
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
  };

  const change = (text: string) => {
    setBody(text);

    if (text.trim() !== '' && open && latestId > 0) {
      thread.ping();
    }
  };

  const openAuthor = useCallback((user: User) => router.push({ pathname: '/users/[username]', params: { username: user.handle } }), [router]);

  const scrollToMessage = useCallback(
    (id: number) => {
      const index = rows.findIndex((row) => (row.type === 'message' || row.type === 'event') && row.message.id === id);

      if (index >= 0) {
        list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } else {
        toast('That message is further up.');
      }
    },
    [rows],
  );

  const react = thread.react;
  const toggleReaction = useCallback(
    async (message: Message, emoji: string) => {
      tap();
      const refused = await react(message, emoji);

      if (refused) {
        toast(refused);
      }
    },
    [react],
  );

  const replyToMessage = useCallback((message: Message) => setReplyTo({ id: message.id, user_id: message.user_id, body: message.body, images_count: message.images?.length ?? 0 }), []);

  const handlers = useMemo(
    () => ({
      onLongPress: (message: Message) => setActing(message),
      onToggleReaction: open ? toggleReaction : undefined,
      // A double tap toggles a heart, and a swipe toward the middle replies, as on the web's touch screens.
      onDoubleTap: open ? (message: Message) => toggleReaction(message, '❤️') : undefined,
      onSwipeReply: open ? replyToMessage : undefined,
      onOpenReply: scrollToMessage,
      onOpenAuthor: openAuthor,
    }),
    [open, toggleReaction, replyToMessage, scrollToMessage, openAuthor],
  );

  const render = useCallback(
    ({ item }: { item: Row }) => {
      switch (item.type) {
        case 'day':
          return <DayLine label={item.label} />;
        case 'head':
          return <HeadLine count={item.count} />;
        case 'event':
          return <EventLine message={item.message} me={me} />;
        case 'message':
          return <MessageBubble message={item.message} me={me} mine={item.mine} authors={authors} showsAuthor={item.showsAuthor} pulled={item.pulled} handlers={handlers} />;
        case 'pending':
          return <PendingBubble message={item.message} authors={authors} onRetry={thread.retry} onDiscard={thread.discard} />;
      }
    },
    [me, authors, handlers, thread.retry, thread.discard],
  );

  const notice = partner ? accessNotice(access, partner.handle) : null;
  const empty = !thread.isPending && rows.length === 0;
  const accent = me ? laneColor(theme, me.lane) : theme.primary;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={partner ? () => openAuthor(partner) : data?.kind === 'org' ? () => setMembersOpen(true) : undefined} style={styles.identity} accessibilityRole="button" accessibilityLabel={title}>
              {partner ? <Avatar user={partner} size={32} /> : <OrgAvatar members={members} me={me} size={32} />}
              <View style={styles.titles}>
                <Text variant="name" numberOfLines={1} style={styles.title}>{title}</Text>
                {subtitle !== '' && <Text variant="mono" muted numberOfLines={1} style={styles.subtitle}>{subtitle}{archived ? ' · stashed' : ''}</Text>}
              </View>
            </Pressable>
          </View>
        }
        right={
          <Pressable onPress={more} hitSlop={8} accessibilityRole="button" accessibilityLabel="More" style={styles.more}>
            <Ellipsis size={22} color={theme.ink} strokeWidth={2} />
          </Pressable>
        }
      />

      <FlashList
        ref={list}
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        renderItem={render}
        maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
        onStartReached={() => thread.loadOlder()}
        onStartReachedThreshold={0.4}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          thread.loadingOlder ? (
            <View style={styles.older}>
              <ActivityIndicator size="small" color={theme.inkMuted} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          thread.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          ) : thread.error ? (
            <EmptyState fatal={thread.error.message} action="Try again" onAction={() => thread.refetch()} />
          ) : empty ? (
            <EmptyState fatal={partner ? `$ git remote add ${partner.handle}` : '$ git remote add org'}>{open ? (partner ? `Nothing pushed yet. Say something to @${partner.handle}.` : 'Nothing pushed yet.') : ''}</EmptyState>
          ) : null
        }
      />

      <MentionSuggestions users={suggestions} onPick={pickMention} />

      <View style={[styles.bottom, { borderTopColor: theme.hairline, backgroundColor: theme.surface, paddingBottom: keyboardShown ? 8 : Math.max(insets.bottom, 8) }]}>
        {typing && <Text variant="mono" muted style={styles.typing}>{typing}</Text>}

        {data && !open ? (
          <View style={styles.notice}>
            <Text variant="small" muted>{notice}</Text>
            {access === 'request' && (
              <View style={styles.noticeActions}>
                <Button title="Merge" size="sm" busy={merge.isPending} onPress={() => merge.mutate()} />
                <Button title="Drop" size="sm" variant="outline" busy={drop.isPending} onPress={() => drop.mutate()} />
              </View>
            )}
          </View>
        ) : (
          <>
            {replyTo && (
              <View style={[styles.replying, { backgroundColor: theme.wash }]}>
                <ReplyGhost reply={replyTo} authors={authors} tint={theme.primary} compact />
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel reply">
                  <X size={18} color={theme.inkMuted} strokeWidth={2} />
                </Pressable>
              </View>
            )}
            {attachments.error && <Text variant="mono" color={theme.destructive} style={styles.error}>{attachments.error}</Text>}
            <AttachmentStrip attachments={attachments} compact />
            <View style={styles.composer}>
              <ToolbarButton icon={ImagePlus} label={attachments.images.length >= MaxImages ? `Up to ${MaxImages} images per message` : 'Attach an image'} onPress={() => chooseImageSource(attachments.pick)} disabled={!open || attachments.picking || attachments.images.length >= MaxImages} />
              <TextInput
                value={body}
                onChangeText={change}
                onSelectionChange={(event) => setCaret(event.nativeEvent.selection.end)}
                selection={selection}
                placeholder={partner ? `Push to @${partner.handle}` : 'Push to the org'}
                placeholderTextColor={theme.inkMuted}
                multiline
                maxLength={MessageMaxLength}
                editable={open}
                style={[styles.input, { color: theme.ink, backgroundColor: theme.wash }]}
                accessibilityLabel="Message"
              />
              <Pressable onPress={send} disabled={!canSend} style={[styles.send, { backgroundColor: accent, opacity: canSend ? 1 : 0.5 }]} accessibilityRole="button" accessibilityLabel="Push" accessibilityState={{ disabled: !canSend }}>
                <SendHorizontal size={18} color={theme.primaryInk} strokeWidth={2} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      <MessageActions
        message={acting}
        me={me}
        reactions={quickReactions(usage.data ?? [])}
        canReact={open && acting?.event == null}
        canReply={open}
        onReact={toggleReaction}
        onReply={replyToMessage}
        onClose={() => setActing(null)}
      />

      <Modal visible={membersOpen} transparent animationType="fade" onRequestClose={() => setMembersOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setMembersOpen(false)} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close">
          <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text variant="section" style={styles.sheetTitle}>{title}</Text>
            <ScrollView style={styles.members}>
              {members.map((member) => (
                <Pressable
                  key={String(member.user.id)}
                  onPress={() => {
                    setMembersOpen(false);
                    openAuthor(member.user);
                  }}
                  style={({ pressed }) => [styles.member, { backgroundColor: pressed ? theme.wash : 'transparent' }]}
                  accessibilityRole="button">
                  <Avatar user={member.user} size={36} />
                  <View style={styles.memberNames}>
                    <Text variant="name" numberOfLines={1}>{member.user.name || member.user.handle}</Text>
                    <Text variant="mono" muted numberOfLines={1} style={styles.subtitle}>@{member.user.handle}</Text>
                  </View>
                  {member.role === 'maintainer' && (
                    <View style={[styles.role, { backgroundColor: theme.wash }]}>
                      <Text variant="mono" muted style={styles.subtitle}>maintainer</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  titles: { flex: 1 },
  title: { fontSize: 15 },
  subtitle: { fontSize: 12, lineHeight: 16 },
  more: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 8 },
  older: { paddingVertical: 12, alignItems: 'center' },
  loading: { paddingVertical: 48, alignItems: 'center' },
  day: { alignItems: 'center', paddingVertical: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Space.gutter, paddingVertical: 8 },
  headRule: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.6 },
  dayText: { fontSize: 11, lineHeight: 14 },
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Space.gutter - 4, paddingTop: 6, gap: 6 },
  typing: { fontSize: 12, lineHeight: 16, paddingHorizontal: 8 },
  notice: { paddingHorizontal: 8, paddingVertical: 8, gap: 10 },
  noticeActions: { flexDirection: 'row', gap: 8 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.lg },
  error: { paddingHorizontal: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  input: { flex: 1, minHeight: 40, maxHeight: 140, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderRadius: 20, fontSize: 16, lineHeight: 20 },
  send: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingTop: 16, paddingHorizontal: Space.gutter },
  sheetTitle: { marginBottom: 8 },
  members: { flexGrow: 0 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderRadius: Radius.md },
  memberNames: { flex: 1 },
  role: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
});
