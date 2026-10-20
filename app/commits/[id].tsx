import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommitRow } from '@/components/commit-row';
import { BodyCounter, StashLabel } from '@/components/composer';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { ThreadReply } from '@/components/thread-reply';
import { Fonts, laneColor, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, nextCursor, Unauthenticated } from '@/lib/client';
import { findCachedCommit, patchCommit } from '@/lib/commit-cache';
import { fits, MaxLength, shortHash } from '@/lib/display';
import { dropStash, getStash, putStash } from '@/lib/stash';
import { threadRows } from '@/lib/timeline';
import type { Commit, Page } from '@/lib/types';
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
    mutationFn: () => api.createCommit(reply.trim(), id),
    onSuccess: async (created) => {
      await dropStash(account.user?.id, `reply-${id}`);
      setReply('');
      setRestored(false);
      setError(null);
      queryClient.setQueryData<{ pages: Page<Commit>[]; pageParams: unknown[] }>(['replies', id], (data) =>
        data && data.pages.length > 0 ? { ...data, pages: [...data.pages.slice(0, -1), { ...data.pages[data.pages.length - 1], data: [...data.pages[data.pages.length - 1].data, created] }] } : { pages: [{ data: [created] }], pageParams: [null] },
      );
      patchCommit(queryClient, id, (c) => ({ ...c, replies_count: c.replies_count + 1 }));
      queryClient.invalidateQueries({ queryKey: ['replies', id] });
      queryClient.invalidateQueries({ queryKey: ['log'] });
    },
    onError: (exception) => setError(exception instanceof ApiError ? exception.firstError() : 'fatal: could not reply.'),
  });

  const commit = thread.data?.commit;
  const rows = useMemo(() => (thread.data ? threadRows([...thread.data.ancestors, thread.data.commit, ...thread.data.series]) : []), [thread.data]);
  const replyList = useMemo(() => replies.data?.pages.flatMap((page) => page.data) ?? [], [replies.data]);
  const isOwn = commit !== undefined && account.user !== null && String(commit.author?.id) === String(account.user.id);
  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: theme.surface }]}>
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

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
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
        <View style={[styles.replyBar, { borderTopColor: theme.hairline, backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 8) }]}>
          {error && <Text variant="mono" color={theme.destructive} style={styles.error}>{error}</Text>}
          <View style={styles.replyRow}>
            <TextInput
              value={reply}
              onChangeText={(text) => {
                setReply(text);
                if (text === '') {
                  setRestored(false);
                }
              }}
              placeholder={`Reply to @${commit.author?.username ?? ''}`}
              placeholderTextColor={theme.inkMuted}
              selectionColor={theme.primary}
              multiline
              maxLength={MaxLength}
              autoFocus={focusReply === '1'}
              style={[styles.replyInput, { color: theme.ink, backgroundColor: theme.wash }]}
            />
            <BodyCounter body={reply} />
            <Pressable onPress={() => send.mutate()} disabled={!fits(reply) || send.isPending} style={[styles.send, { backgroundColor: accent, opacity: fits(reply) && !send.isPending ? 1 : 0.5 }]} accessibilityRole="button">
              <Text variant="label" color={theme.primaryInk}>Reply</Text>
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
  replyBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Space.gutter, paddingTop: 8, gap: 6 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  replyInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 20, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, maxHeight: 120 },
  send: { height: 32, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stash: { paddingLeft: 4 },
  error: { fontSize: 12, lineHeight: 16 },
});
