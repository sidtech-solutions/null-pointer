import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Code, Eye, ImagePlus, Trash2 } from 'lucide-react-native';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CodeSuggestion, LanguageSheet, useCodePaste } from '@/components/code-tools';
import { CommitRow } from '@/components/commit-row';
import { DraftPreview } from '@/components/draft-preview';
import { AttachmentStrip, BodyCounter, chooseImageSource, StashLabel, ToolbarButton, toUploads, useAttachments } from '@/components/composer';
import { MentionSuggestions } from '@/components/mention-suggestions';
import { MaxImages } from '@/lib/images';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { ThreadReply } from '@/components/thread-reply';
import { Fonts, laneColor, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, nextCursor, Unauthenticated } from '@/lib/client';
import { findCachedCommit, patchCommit } from '@/lib/commit-cache';
import { fits, length, MaxLength, shortHash } from '@/lib/display';
import { useKeyboardShown } from '@/lib/keyboard';
import { insertMention, mentionBeforeCaret, useMentionSuggestions } from '@/lib/mentions';
import { isOnline } from '@/lib/network';
import { enqueue, isOffline } from '@/lib/outbox';
import { dropStash, getStash, putStash } from '@/lib/stash';
import { threadRows } from '@/lib/timeline';
import { toast } from '@/lib/toast';
import type { Commit, Page, User } from '@/lib/types';
import { useCommitHandlers } from '@/lib/use-commit-handlers';

export default function CommitScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const handlers = useCommitHandlers();
  const { id, reply: focusReply } = useLocalSearchParams<{ id: string; reply?: string }>();
  const [reply, setReply] = useState('');
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const attachments = useAttachments();
  const keyboardShown = useKeyboardShown();
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const mention = mentionBeforeCaret(reply, caret);
  const suggestions = useMentionSuggestions(mention, { reply: id });

  useEffect(() => {
    if (selection) {
      const timer = setTimeout(() => setSelection(undefined), 50);

      return () => clearTimeout(timer);
    }
  }, [selection]);

  const pickMention = (user: User) => {
    if (!mention) {
      return;
    }

    const next = insertMention(reply, mention, user.handle);
    setReply(next.text);
    setCaret(next.caret);
    setSelection({ start: next.caret, end: next.caret });
  };

  const paste = useCodePaste(reply, caret, (text, at) => {
    setReply(text);
    setCaret(at);
    setSelection({ start: at, end: at });
  });

  const thread = useQuery({
    queryKey: ['commit', id],
    queryFn: () => api.commit(id),
    placeholderData: () => {
      const cached = findCachedCommit(queryClient, id);

      return cached ? { commit: cached, ancestors: [], series: [] } : undefined;
    },
  });

  const replies = useInfiniteQuery({
    queryKey: ['replies', id],
    queryFn: ({ pageParam }) => api.replies(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  useEffect(() => {
    getStash(account.user?.id, `reply-${id}`).then((draft) => {
      setReply(draft);
      setRestored(draft !== '');
      setReady(true);
    });
  }, [account.user?.id, id]);

  useEffect(() => {
    if (ready) {
      putStash(account.user?.id, `reply-${id}`, reply);
    }
  }, [reply, ready, account.user?.id, id]);

  useEffect(() => {
    const failure = thread.error ?? replies.error;

    if (failure instanceof Unauthenticated) {
      account.signOut().then(() => router.replace('/onboarding'));
    }
  }, [thread.error, replies.error, account, router]);

  const send = useMutation({
    mutationFn: async () => {
      const { uploads, descriptions } = await toUploads(attachments.images);

      return api.createCommit(reply.trim(), { parentId: id, images: uploads, descriptions });
    },
    onSuccess: async (created) => {
      await dropStash(account.user?.id, `reply-${id}`);
      setReply('');
      setRestored(false);
      setError(null);
      setPreviewing(false);
      attachments.clear();
      queryClient.setQueryData<{ pages: Page<Commit>[]; pageParams: unknown[] }>(['replies', id], (data) =>
        data && data.pages.length > 0 ? { ...data, pages: [...data.pages.slice(0, -1), { ...data.pages[data.pages.length - 1], data: [...data.pages[data.pages.length - 1].data, created] }] } : { pages: [{ data: [created] }], pageParams: [null] },
      );
      patchCommit(queryClient, id, (c) => ({ ...c, replies_count: c.replies_count + 1 }));
      queryClient.invalidateQueries({ queryKey: ['replies', id] });
      queryClient.invalidateQueries({ queryKey: ['log'] });
      // The reply goes under the last one loaded, so that is where to look.
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
      toast(`[reply ${created.short_hash || shortHash(created.id)}] ${created.status === 'approved' || created.status === '' ? 'posted.' : 'waiting for approval.'}`);
    },
    onError: (exception) => {
      if (isOffline(exception)) {
        keepForLater();

        return;
      }

      setError(exception instanceof ApiError ? exception.firstError() : exception instanceof Error && exception.message ? exception.message : 'fatal: could not reply.');
    },
  });

  const keepForLater = async () => {
    await enqueue({ body: reply.trim(), parentId: id, images: attachments.images });
    await dropStash(account.user?.id, `reply-${id}`);
    setReply('');
    setRestored(false);
    setError(null);
    attachments.clear();
    toast('Offline. Kept in the outbox; it replies when you are back online.');
  };

  const submitReply = () => {
    if (!isOnline()) {
      keepForLater();
    } else {
      send.mutate();
    }
  };

  const commit = thread.data?.commit;
  const rows = useMemo(() => (thread.data ? threadRows([...thread.data.ancestors, thread.data.commit, ...thread.data.series]) : []), [thread.data]);
  const replyList = useMemo(() => replies.data?.pages.flatMap((page) => page.data) ?? [], [replies.data]);
  const isOwn = commit !== undefined && account.user !== null && String(commit.author?.id) === String(account.user.id);
  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;
  const hasImages = attachments.images.length > 0;
  const canSend = (hasImages && reply.trim() === '' ? true : fits(reply)) && length(reply) <= MaxLength && !send.isPending;

  const confirmDelete = () =>
    Alert.alert('Delete this commit?', "There's no undo.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (commit) {
            handlers.onDelete?.(commit);
            router.back();
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Commit</Text>
            <Text variant="mono" muted>{commit?.short_hash || shortHash(id)}</Text>
          </View>
        }
        right={
          isOwn ? (
            <Pressable onPress={confirmDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete commit">
              <Trash2 size={20} color={theme.destructive} strokeWidth={2} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!commit && thread.isPending && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.inkMuted} />
          </View>
        )}

        {!commit && thread.isError && <EmptyState fatal={thread.error.message} action="Try again" onAction={() => thread.refetch()} />}

        {rows.map((row, index) => {
          const isFocused = row.commit.id === commit?.id;
          const last = index === rows.length - 1;
          const previous = index === 0 ? undefined : laneColor(theme, rows[index - 1].commit.author?.lane);
          const hasThread = isFocused && replyList.length > 0;
          const lane = laneColor(theme, row.commit.author?.lane);

          return (
            <View key={row.key}>
              <CommitRow
                commit={row.commit}
                previousLane={previous}
                continuesRun={row.continuesRun}
                continuesNext={isFocused ? !last : undefined}
                focused={isFocused}
                muted={!isFocused}
                withTail={!last}
                threadBelow={hasThread}
                viewerId={account.user?.id}
                handlers={handlers}
              />
              {isFocused && replies.isPending && (
                <View style={styles.loadingReplies}>
                  <ActivityIndicator size="small" color={theme.inkMuted} />
                </View>
              )}
              {hasThread &&
                replyList.map((threadReply, replyIndex) => {
                  const lastReply = replyIndex === replyList.length - 1;
                  const hasNext = !lastReply || replies.hasNextPage;

                  return (
                    <ThreadReply
                      key={threadReply.id}
                      reply={threadReply}
                      lane={lane}
                      previousLane={replyIndex === 0 ? undefined : laneColor(theme, replyList[replyIndex - 1].author?.lane)}
                      hasNext={hasNext}
                      railLane={last ? undefined : lane}
                      last={lastReply}
                      muted
                      more={lastReply && replies.hasNextPage ? () => replies.fetchNextPage() : undefined}
                            viewerId={account.user?.id}
                      handlers={handlers}
                    />
                  );
                })}
            </View>
          );
        })}

        {commit && replies.isSuccess && replyList.length === 0 && (
          <View style={styles.noReplies}>
            <Text variant="small" muted>No replies yet.</Text>
          </View>
        )}
      </ScrollView>

      {commit && (
        <View style={[styles.replyBar, { borderTopColor: theme.hairline, backgroundColor: theme.surface, paddingBottom: keyboardShown ? 8 : Math.max(insets.bottom, 8) }]}>
          {!previewing && <CodeSuggestion paste={paste} />}
          <MentionSuggestions users={suggestions} onPick={pickMention} />
          {error && <Text variant="mono" color={theme.destructive} style={styles.error}>{error}</Text>}
          {!previewing && <AttachmentStrip attachments={attachments} compact />}
          {previewing && (
            <ScrollView style={styles.replyPreview} contentContainerStyle={styles.replyPreviewContent} keyboardShouldPersistTaps="handled">
              <DraftPreview body={reply} author={account.user} images={attachments.images} onOpenMention={(username) => router.push({ pathname: '/users/[username]', params: { username } })} />
            </ScrollView>
          )}
          <View style={styles.replyRow}>
            <ToolbarButton icon={ImagePlus} label={hasImages && attachments.images.length >= MaxImages ? `Up to ${MaxImages} images per reply` : 'Attach an image'} onPress={() => chooseImageSource(attachments.pick)} disabled={previewing || attachments.picking || attachments.images.length >= MaxImages || send.isPending} />
            <ToolbarButton icon={Code} label="Paste the clipboard as a code block" onPress={paste.fromClipboard} disabled={previewing || send.isPending} />
            <ToolbarButton icon={Eye} label={previewing ? 'Back to writing' : 'Preview'} onPress={() => setPreviewing((current) => !current)} active={previewing} disabled={send.isPending} />
            {previewing ? (
              <View style={styles.replySpacer} />
            ) : (
              <TextInput
                value={reply}
                onChangeText={(text) => {
                  setReply(text);
                  if (text === '') {
                    setRestored(false);
                  }
                }}
                onSelectionChange={(event) => setCaret(event.nativeEvent.selection.end)}
                selection={selection}
                placeholder={hasImages ? 'Add a caption (optional)' : `Reply to @${commit.author?.handle ?? ''}`}
                placeholderTextColor={theme.inkMuted}
                selectionColor={theme.primary}
                multiline
                maxLength={MaxLength}
                autoFocus={focusReply === '1'}
                style={[styles.replyInput, { color: theme.ink, backgroundColor: theme.wash }]}
              />
            )}
            <BodyCounter body={reply} />
            <Pressable onPress={submitReply} disabled={!canSend} style={[styles.send, { backgroundColor: accent, opacity: canSend || send.isPending ? 1 : 0.5 }]} accessibilityRole="button" accessibilityState={{ disabled: !canSend, busy: send.isPending }}>
              {send.isPending ? <ActivityIndicator size="small" color={theme.primaryInk} /> : <Text variant="label" color={theme.primaryInk}>Reply</Text>}
            </Pressable>
          </View>
          {restored && (
            <View style={styles.stash}>
              <StashLabel
                onDrop={() => {
                  setReply('');
                  setRestored(false);
                  dropStash(account.user?.id, `reply-${id}`);
                }}
              />
            </View>
          )}
        </View>
      )}
      <LanguageSheet paste={paste} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  content: { paddingBottom: 24 },
  loading: { paddingVertical: 64, alignItems: 'center' },
  loadingReplies: { paddingLeft: Space.rail, paddingVertical: 16 },
  noReplies: { paddingLeft: Space.rail, paddingRight: Space.gutter, paddingVertical: 16 },
  replyBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Space.gutter, paddingTop: 8, gap: 8 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  replyPreview: { maxHeight: 280 },
  replyPreviewContent: { paddingHorizontal: 4, paddingVertical: 8 },
  replySpacer: { flex: 1 },
  replyInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 20, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, maxHeight: 120 },
  send: { height: 36, minWidth: 64, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stash: { paddingLeft: 4 },
  error: { fontSize: 12, lineHeight: 16 },
});
