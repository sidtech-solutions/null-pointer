import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Code, Eye, ImagePlus, Trash2 } from "lucide-react-native";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommitRow } from "@/components/commit-row";
import { DraftPreview } from "@/components/draft-preview";
import {
  AttachmentStrip,
  chooseImageSource,
  DraftCounter,
  DraftInput,
  StashLabel,
  ToolbarButton,
  toUploads,
  useAttachments,
} from "@/components/composer";
import { DraftTools } from "@/components/draft-tools";
import { MaxImages } from "@/lib/images";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRow } from "@/components/skeleton-row";
import { Header } from "@/components/header";
import { Text } from "@/components/text";
import { ThreadReply } from "@/components/thread-reply";
import { Fonts, laneColor, Radius, Space, useTheme } from "@/constants/theme";
import { useAccount } from "@/lib/account";
import { api, ApiError, nextCursor, Unauthenticated } from "@/lib/client";
import { findCachedCommit, patchCommit } from "@/lib/commit-cache";
import { fits, length, MaxLength, shortHash } from "@/lib/display";
import { createDraft, type Draft, useDraftText } from "@/lib/draft";
import { notify } from "@/lib/haptics";
import { useKeyboardShown } from "@/lib/keyboard";
import { isOnline } from "@/lib/network";
import { enqueue, isOffline } from "@/lib/outbox";
import { dropStash, getStash, putStash } from "@/lib/stash";
import { threadRows } from "@/lib/timeline";
import { toast } from "@/lib/toast";
import type { Commit, Page } from "@/lib/types";
import { useCommitHandlers } from "@/lib/use-commit-handlers";

export default function CommitScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const handlers = useCommitHandlers();
  const { id, reply: focusReply } = useLocalSearchParams<{
    id: string;
    reply?: string;
  }>();
  // The reply's text lives outside React: a keystroke re-renders the input and the strips, not the thread.
  const [draft] = useState(() => createDraft(""));
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const attachments = useAttachments();
  const keyboardShown = useKeyboardShown();

  const thread = useQuery({
    queryKey: ["commit", id],
    queryFn: () => api.commit(id),
    placeholderData: () => {
      const cached = findCachedCommit(queryClient, id);

      return cached ? { commit: cached, ancestors: [], series: [] } : undefined;
    },
  });

  const replies = useInfiniteQuery({
    queryKey: ["replies", id],
    queryFn: ({ pageParam }) => api.replies(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => nextCursor(last),
  });

  // Commits near this one in meaning, under the thread as the web lists them; asked for once the thread is here.
  const related = useQuery({
    queryKey: ["related", id],
    queryFn: () => api.relatedCommits(id),
    enabled: thread.isSuccess,
    staleTime: 10 * 60_000,
    retry: false,
  });

  useEffect(() => {
    getStash(account.user?.id, `reply-${id}`).then((stashed) => {
      // Anything typed before the stash came back wins over the stash.
      if (stashed !== "" && draft.get() === "") {
        draft.write(stashed);
      }

      setRestored(stashed !== "");
      setReady(true);
    });
  }, [account.user?.id, id, draft]);

  // Kept a moment after the last keystroke and once more on the way out; emptying the text retires the stash label.
  useEffect(() => {
    if (!ready) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = draft.subscribe(() => {
      if (draft.get() === "") {
        setRestored(false);
      }

      clearTimeout(timer);
      timer = setTimeout(
        () => putStash(account.user?.id, `reply-${id}`, draft.get()),
        400,
      );
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
      putStash(account.user?.id, `reply-${id}`, draft.get());
    };
  }, [ready, account.user?.id, id, draft]);

  useEffect(() => {
    const failure = thread.error ?? replies.error;

    if (failure instanceof Unauthenticated) {
      account.signOut();
    }
  }, [thread.error, replies.error, account, router]);

  const send = useMutation({
    mutationFn: async () => {
      const { uploads, descriptions } = await toUploads(attachments.images);

      return api.createCommit(draft.get().trim(), {
        parentId: id,
        images: uploads,
        descriptions,
      });
    },
    onSuccess: async (created) => {
      await dropStash(account.user?.id, `reply-${id}`);
      draft.write("");
      setRestored(false);
      setError(null);
      setPreviewing(false);
      attachments.clear();
      queryClient.setQueryData<{
        pages: Page<Commit>[];
        pageParams: unknown[];
      }>(["replies", id], (data) =>
        data && data.pages.length > 0
          ? {
              ...data,
              pages: [
                ...data.pages.slice(0, -1),
                {
                  ...data.pages[data.pages.length - 1],
                  data: [...data.pages[data.pages.length - 1].data, created],
                },
              ],
            }
          : { pages: [{ data: [created] }], pageParams: [null] },
      );
      patchCommit(queryClient, id, (c) => ({
        ...c,
        replies_count: c.replies_count + 1,
      }));
      queryClient.invalidateQueries({ queryKey: ["replies", id] });
      queryClient.invalidateQueries({ queryKey: ["log"] });
      // The reply goes under the last one loaded, so that is where to look.
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
      notify("success");
      toast(
        `[reply ${created.short_hash || shortHash(created.id)}] ${created.status === "approved" || created.status === "" ? "posted." : "waiting for approval."}`,
      );
    },
    onError: (exception) => {
      if (isOffline(exception)) {
        keepForLater();

        return;
      }

      notify("error");
      setError(
        exception instanceof ApiError
          ? exception.firstError()
          : exception instanceof Error && exception.message
            ? exception.message
            : "fatal: could not reply.",
      );
    },
  });

  const keepForLater = async () => {
    await enqueue({
      body: draft.get().trim(),
      parentId: id,
      images: attachments.images,
    });
    await dropStash(account.user?.id, `reply-${id}`);
    draft.write("");
    setRestored(false);
    setError(null);
    attachments.clear();
    toast("Offline. Kept in the outbox; it replies when you are back online.");
  };

  const submitReply = () => {
    if (!isOnline()) {
      keepForLater();
    } else {
      send.mutate();
    }
  };

  const commit = thread.data?.commit;
  const rows = useMemo(
    () =>
      thread.data
        ? threadRows([
            ...thread.data.ancestors,
            thread.data.commit,
            ...thread.data.series,
          ])
        : [],
    [thread.data],
  );
  const replyList = useMemo(
    () => replies.data?.pages.flatMap((page) => page.data) ?? [],
    [replies.data],
  );
  const isOwn =
    commit !== undefined &&
    account.user !== null &&
    String(commit.author?.id) === String(account.user.id);
  const accent = account.user
    ? laneColor(theme, account.user.lane)
    : theme.primary;
  const hasImages = attachments.images.length > 0;
  const canSend = (body: string) =>
    (hasImages && body.trim() === "" ? true : fits(body)) &&
    length(body) <= MaxLength &&
    !send.isPending;

  const confirmDelete = () =>
    Alert.alert("Delete this commit?", "There's no undo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (commit) {
            handlers.onDelete?.(commit);
            router.back();
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: theme.surface }]}
    >
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>
              Commit
            </Text>
            <Text variant="mono" muted>
              {commit?.short_hash || shortHash(id)}
            </Text>
          </View>
        }
        right={
          isOwn ? (
            <Pressable
              onPress={confirmDelete}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Delete commit"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Trash2 size={20} color={theme.destructive} strokeWidth={2} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {!commit && thread.isPending && (
          <View>
            <SkeletonRow />
            <SkeletonRow previousLane={theme.rail} />
          </View>
        )}

        {!commit && thread.isError && (
          <EmptyState
            fatal={thread.error.message}
            action="Try again"
            onAction={() => thread.refetch()}
          />
        )}

        {rows.map((row, index) => {
          const isFocused = row.commit.id === commit?.id;
          const last = index === rows.length - 1;
          const previous =
            index === 0
              ? undefined
              : laneColor(theme, rows[index - 1].commit.author?.lane);
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
              {isFocused && replies.isError && !hasThread && (
                <View style={styles.noReplies}>
                  <Text variant="mono" muted>
                    fatal: could not load the replies
                  </Text>
                  <Pressable
                    onPress={() => replies.refetch()}
                    hitSlop={12}
                    accessibilityRole="button"
                    style={styles.retry}
                  >
                    <Text variant="small" color={theme.primary}>
                      Try again
                    </Text>
                  </Pressable>
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
                      previousLane={
                        replyIndex === 0
                          ? undefined
                          : laneColor(
                              theme,
                              replyList[replyIndex - 1].author?.lane,
                            )
                      }
                      hasNext={hasNext}
                      railLane={last ? undefined : lane}
                      last={lastReply}
                      muted
                      more={
                        lastReply && replies.hasNextPage
                          ? () => replies.fetchNextPage()
                          : undefined
                      }
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
            <Text variant="small" muted>
              No replies yet.
            </Text>
          </View>
        )}

        {related.data && related.data.length > 0 && (
          <View style={[styles.related, { borderTopColor: theme.hairline }]}>
            <View style={styles.relatedHeading}>
              <Text variant="mono" muted style={styles.relatedTitle}>
                related commits
              </Text>
            </View>
            {related.data.map((candidate, index) => (
              <CommitRow
                key={candidate.id}
                commit={candidate}
                continuesNext={false}
                previousLane={
                  index === 0
                    ? undefined
                    : laneColor(theme, related.data[index - 1].author?.lane)
                }
                muted
                viewerId={account.user?.id}
                handlers={handlers}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {commit && (
        <View
          style={[
            styles.replyBar,
            {
              borderTopColor: theme.hairline,
              backgroundColor: theme.surface,
              paddingBottom: keyboardShown ? 8 : Math.max(insets.bottom, 8),
            },
          ]}
        >
          <DraftTools draft={draft} context={{ reply: id }} hidden={previewing}>
            {(paste) => (
              <>
                {error && (
                  <Text
                    variant="mono"
                    color={theme.destructive}
                    style={styles.error}
                  >
                    {error}
                  </Text>
                )}
                {!previewing && (
                  <AttachmentStrip attachments={attachments} compact />
                )}
                {previewing && (
                  <ScrollView
                    style={styles.replyPreview}
                    contentContainerStyle={styles.replyPreviewContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    <DraftPreview
                      body={draft.get()}
                      author={account.user}
                      images={attachments.images}
                      onOpenMention={(username) =>
                        router.push({
                          pathname: "/users/[username]",
                          params: { username },
                        })
                      }
                    />
                  </ScrollView>
                )}
                <View style={styles.replyRow}>
                  <ToolbarButton
                    icon={ImagePlus}
                    label={
                      hasImages && attachments.images.length >= MaxImages
                        ? `Up to ${MaxImages} images per reply`
                        : "Attach an image"
                    }
                    onPress={() => chooseImageSource(attachments.pick)}
                    disabled={
                      previewing ||
                      attachments.picking ||
                      attachments.images.length >= MaxImages ||
                      send.isPending
                    }
                  />
                  <ToolbarButton
                    icon={Code}
                    label="Paste the clipboard as a code block"
                    onPress={paste.fromClipboard}
                    disabled={previewing || send.isPending}
                  />
                  <ToolbarButton
                    icon={Eye}
                    label={previewing ? "Back to writing" : "Preview"}
                    onPress={() => setPreviewing((current) => !current)}
                    active={previewing}
                    disabled={send.isPending}
                  />
                  {previewing ? (
                    <View style={styles.replySpacer} />
                  ) : (
                    <DraftInput
                      draft={draft}
                      placeholder={
                        hasImages
                          ? "Add a caption (optional)"
                          : `Reply to @${commit.author?.handle ?? ""}`
                      }
                      autoFocus={focusReply === "1"}
                      accessibilityLabel="Your reply"
                      style={[
                        styles.replyInput,
                        { backgroundColor: theme.wash },
                      ]}
                    />
                  )}
                  <DraftCounter draft={draft} />
                  <ReplyButton
                    draft={draft}
                    canSend={canSend}
                    busy={send.isPending}
                    accent={accent}
                    onPress={submitReply}
                  />
                </View>
                {restored && (
                  <View style={styles.stash}>
                    <StashLabel
                      onDrop={() => {
                        draft.write("");
                        setRestored(false);
                        dropStash(account.user?.id, `reply-${id}`);
                      }}
                    />
                  </View>
                )}
              </>
            )}
          </DraftTools>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Enabled by what is written; reads the draft itself so the thread above stays still while typing. */
function ReplyButton({
  draft,
  canSend,
  busy,
  accent,
  onPress,
}: {
  draft: Draft;
  canSend: (body: string) => boolean;
  busy: boolean;
  accent: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const enabled = canSend(useDraftText(draft));

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.send,
        {
          backgroundColor: accent,
          opacity: !(enabled || busy) ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.primaryInk} />
      ) : (
        <Text variant="label" color={theme.primaryInk}>
          Reply
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: -8,
  },
  back: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16 },
  content: { paddingBottom: 24 },
  loading: { paddingVertical: 64, alignItems: "center" },
  loadingReplies: { paddingLeft: Space.rail, paddingVertical: 16 },
  noReplies: {
    paddingLeft: Space.rail,
    paddingRight: Space.gutter,
    paddingVertical: 16,
    gap: 8,
  },
  retry: { alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
  related: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  relatedHeading: {
    paddingLeft: Space.rail,
    paddingRight: Space.gutter,
    paddingTop: 16,
    paddingBottom: 4,
  },
  relatedTitle: { fontSize: 12, lineHeight: 16 },
  replyBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.gutter,
    paddingTop: 8,
    gap: 8,
  },
  replyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: -8,
  },
  replyPreview: { maxHeight: 280 },
  replyPreviewContent: { paddingHorizontal: 4, paddingVertical: 8 },
  replySpacer: { flex: 1 },
  replyInput: {
    flex: 1,
    minHeight: 0,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingTop: 8,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    maxHeight: 120,
  },
  send: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  stash: { paddingLeft: 4 },
  error: { fontSize: 12, lineHeight: 16 },
});
