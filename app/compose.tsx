import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { Clock, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommitBody } from '@/components/commit-body';
import { DraftPreview } from '@/components/draft-preview';
import { DraftTools } from '@/components/draft-tools';
import { SchedulePicker } from '@/components/schedule-picker';
import { AttachmentStrip, ComposerToolbar, DraftCounter, DraftInput, emptyPoll, PollEditor, pollFits, StashLabel, toUploads, useAttachments } from '@/components/composer';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import { findCachedCommit, prependCommit } from '@/lib/commit-cache';
import { fits, length, MaxLength, relativeTime, shortHash } from '@/lib/display';
import { createDraft, type Draft, useDraftText } from '@/lib/draft';
import { notify } from '@/lib/haptics';
import { useKeyboardShown } from '@/lib/keyboard';
import { isOnline } from '@/lib/network';
import { enqueue, isOffline } from '@/lib/outbox';
import { scheduledAtOf, scheduleLabel } from '@/lib/schedule';
import { sharedText, withShared } from '@/lib/share-target';
import { dropStash, getStash, putStash } from '@/lib/stash';
import { toast } from '@/lib/toast';
import { refreshStreakWidget } from '@/lib/widgets';
import type { NewPoll } from '@/lib/types';

export default function ComposeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const account = useAccount();
  // Set once the commit is on its way, so the guard lets the screen go.
  const [left, setLeft] = useState(false);
  const leave = () => {
    setLeft(true);
    router.back();
  };
  const { quote } = useLocalSearchParams<{ quote?: string }>();
  const stashName = quote ? `quote-${quote}` : 'composer';
  // The text lives outside React: a keystroke re-renders the input and the strips that read it, not this screen.
  const [draft] = useState(() => createDraft(''));
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [poll, setPoll] = useState<NewPoll | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const attachments = useAttachments();
  const keyboardShown = useKeyboardShown();
  // When the commit should go, or null for now. Only a top-level commit waits, as on the web.
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [picking, setPicking] = useState(false);

  const quoted = useQuery({
    queryKey: ['commit', quote],
    queryFn: () => api.commit(quote!),
    enabled: Boolean(quote),
    placeholderData: () => {
      const cached = quote ? findCachedCommit(queryClient, quote) : null;

      return cached ? { commit: cached, ancestors: [], series: [] } : undefined;
    },
  });

  useEffect(() => {
    getStash(account.user?.id, stashName).then((stashed) => {
      // Anything typed before the stash came back wins over the stash.
      if (stashed !== '' && draft.get() === '') {
        draft.write(stashed);
      }

      setRestored(stashed !== '');
      setReady(true);
    });
  }, [account.user?.id, stashName, draft]);

  // The draft is kept a moment after the last keystroke, not on every one, and
  // once more on the way out: storage stays off the typing path. Emptying the
  // text also retires the stash label.
  useEffect(() => {
    if (!ready) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = draft.subscribe(() => {
      if (draft.get() === '') {
        setRestored(false);
      }

      clearTimeout(timer);
      timer = setTimeout(() => putStash(account.user?.id, stashName, draft.get()), 400);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
      putStash(account.user?.id, stashName, draft.get());
    };
  }, [ready, account.user?.id, stashName, draft]);

  // Something another app shared lands here once the stash is back: its text under the draft, its images attached.
  const share = useShareIntentContext();
  const { addShared } = attachments;

  useEffect(() => {
    if (!ready || !share.hasShareIntent) {
      return;
    }

    const text = sharedText(share.shareIntent);
    const files = share.shareIntent.files ?? [];

    share.resetShareIntent();

    if (text !== '') {
      draft.write(withShared(draft.get(), text));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestored(false);
    }

    if (files.length > 0) {
      addShared(files);
    }
  }, [ready, share, addShared, draft]);

  const hasImages = attachments.images.length > 0;
  // With images the body may be empty; a poll needs its question. Either way a non-empty body must fit.
  const canCommit = (body: string) => (hasImages && body.trim() === '' ? true : fits(body)) && length(body) <= MaxLength && (poll === null || pollFits(poll));

  const commit = useMutation({
    mutationFn: async () => {
      const { uploads, descriptions } = await toUploads(attachments.images);

      return api.createCommit(draft.get().trim(), { quotedCommitId: quote ?? null, images: uploads, descriptions, poll: poll ? { ...poll, options: poll.options.map((option) => option.trim()) } : null });
    },
    onSuccess: async (created) => {
      await dropStash(account.user?.id, stashName);
      // Leave first: the screen unmounts under the dismiss, so nothing flashes empty.
      leave();
      prependCommit(queryClient, created);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      refreshStreakWidget({ force: true });
      notify('success');
      toast(`[log ${created.short_hash || shortHash(created.id)}] ${(created.body || (created.images?.length ? `${created.images.length} ${created.images.length === 1 ? 'image' : 'images'}` : '')).split('\n')[0].slice(0, 60)}`);
    },
    onError: (exception) => {
      if (isOffline(exception)) {
        keepForLater();

        return;
      }

      notify('error');
      setError(exception instanceof ApiError ? exception.firstError() : exception instanceof Error && exception.message ? exception.message : 'fatal: could not commit.');
    },
  });

  // A scheduled commit is kept on the server, not here, so it needs a connection now.
  const schedule = useMutation({
    mutationFn: async () => {
      const { uploads, descriptions } = await toUploads(attachments.images);

      return api.scheduleCommit(draft.get().trim(), scheduledAtOf(scheduledAt ?? new Date()), { images: uploads, descriptions, poll: poll ? { ...poll, options: poll.options.map((option) => option.trim()) } : null });
    },
    onSuccess: async (created) => {
      await dropStash(account.user?.id, stashName);
      leave();
      queryClient.invalidateQueries({ queryKey: ['scheduled'] });
      notify('success');
      toast(`Scheduled for ${scheduleLabel(created.scheduled_at)}.`);
    },
    onError: (exception) => setError(exception instanceof ApiError ? exception.firstError() : exception instanceof Error && exception.message ? exception.message : 'fatal: could not schedule the commit.'),
  });

  // No connection: the draft goes to the outbox and is pushed when one comes back.
  const keepForLater = async () => {
    const trimmed = draft.get().trim();

    await enqueue({ body: trimmed, quotedCommitId: quote ?? null, poll: poll ? { ...poll, options: poll.options.map((option) => option.trim()) } : null, images: attachments.images });
    await dropStash(account.user?.id, stashName);
    leave();
    notify('warning');
    toast('Offline. Kept in the outbox; it commits when you are back online.');
  };

  const submit = () => {
    if (scheduledAt) {
      setError(null);
      schedule.mutate();
    } else if (!isOnline()) {
      keepForLater();
    } else {
      commit.mutate();
    }
  };

  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;
  const handle = quoted.data?.commit.author?.handle;
  const busy = commit.isPending || schedule.isPending;

  // Text survives in the stash; images and a poll do not. Leaving with either
  // asks first, whether by Cancel, the iOS swipe down or Android back.
  const dirty = (hasImages || poll !== null) && !left;

  usePreventRemove(dirty, ({ data }) => {
    Alert.alert('Discard this commit?', hasImages ? 'Your text is kept, the images are not.' : 'Your text is kept, the poll is not.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const cancel = () => router.back();

  const togglePoll = () => {
    setError(null);
    setPoll((current) => (current ? null : emptyPoll));
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: theme.surface, paddingTop: Platform.OS === 'ios' ? Math.max(12, insets.top - 44) : insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={cancel} disabled={busy} hitSlop={8} style={styles.barButton} accessibilityRole="button" accessibilityHint="Keeps your draft for next time">
          <Text variant="nav">Cancel</Text>
        </Pressable>
        <Text variant="name" numberOfLines={1} style={styles.title}>{quote ? `Quote @${handle ?? ''}` : 'New commit'}</Text>
        <View style={styles.barButton}>
          <SubmitButton draft={draft} canCommit={canCommit} busy={busy} accent={accent} label={scheduledAt ? 'Schedule' : 'Commit'} onPress={submit} />
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} style={styles.scroll}>
        {error && <Text variant="small" color={theme.destructive}>{error}</Text>}

        {previewing ? (
          <DraftPreview body={draft.get()} author={account.user} images={attachments.images} poll={poll} quoted={quoted.data?.commit ?? null} onOpenMention={(username) => router.push({ pathname: '/users/[username]', params: { username } })} />
        ) : (
          <DraftInput
            draft={draft}
            placeholder={quote ? 'Add your take' : poll ? 'Ask a question' : hasImages ? 'Say something about it (optional)' : 'What did you ship?'}
            autoFocus
            editable={!busy}
            accessibilityLabel="Your commit"
            style={styles.input}
          />
        )}

        {scheduledAt && (
          <View style={[styles.scheduled, { backgroundColor: theme.primarySoft }]}>
            <Clock size={14} color={theme.primary} strokeWidth={2} />
            <Pressable onPress={() => setPicking(true)} style={styles.scheduledText} accessibilityRole="button" accessibilityLabel={`Scheduled for ${scheduleLabel(scheduledAt)}. Change`}>
              <Text variant="small" color={theme.primary} numberOfLines={1}>Commits {scheduleLabel(scheduledAt)}</Text>
            </Pressable>
            <Pressable onPress={() => setScheduledAt(null)} hitSlop={14} accessibilityRole="button" accessibilityLabel="Commit now instead">
              <X size={16} color={theme.primary} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {!previewing && <AttachmentStrip attachments={attachments} />}

        {poll && !previewing && <PollEditor poll={poll} onChange={setPoll} onRemove={() => setPoll(null)} />}

        {quoted.data && !previewing && (
          <View style={[styles.quoted, { borderColor: theme.hairline }]}>
            <View style={styles.quotedHeader}>
              <Text variant="name" numberOfLines={1} style={styles.quotedName}>{quoted.data.commit.author?.name || handle}</Text>
              <Text variant="mono" muted style={styles.tiny}>@{handle} · {relativeTime(quoted.data.commit.created_at)}</Text>
            </View>
            <CommitBody body={quoted.data.commit.body} size={14} numberOfLines={6} />
          </View>
        )}
      </ScrollView>

      <SchedulePicker visible={picking} value={scheduledAt} onPick={setScheduledAt} onClear={() => setScheduledAt(null)} onClose={() => setPicking(false)} />

      <DraftTools draft={draft} context={{ quote }} hidden={previewing}>
        {(paste) => (
          <View style={[styles.footer, { borderTopColor: theme.hairline, paddingBottom: keyboardShown ? 4 : Math.max(insets.bottom, 8) }]}>
            <ComposerToolbar attachments={attachments} poll={poll} onTogglePoll={togglePoll} withPoll={!quote} previewing={previewing} onTogglePreview={() => setPreviewing((current) => !current)} onPasteCode={paste.fromClipboard} onSchedule={quote ? undefined : () => setPicking(true)} scheduled={scheduledAt !== null}>
              {restored && (
                <StashLabel
                  onDrop={() => {
                    draft.write('');
                    setRestored(false);
                    dropStash(account.user?.id, stashName);
                  }}
                />
              )}
              <DraftCounter draft={draft} />
            </ComposerToolbar>
          </View>
        )}
      </DraftTools>
    </KeyboardAvoidingView>
  );
}

/** Enabled by what is written; reads the draft itself so the bar above it stays still while typing. */
function SubmitButton({ draft, canCommit, busy, accent, label, onPress }: { draft: Draft; canCommit: (body: string) => boolean; busy: boolean; accent: string; label: string; onPress: () => void }) {
  const theme = useTheme();
  const enabled = canCommit(useDraftText(draft));

  return (
    <Pressable onPress={onPress} disabled={!enabled || busy} hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [styles.commit, pressed && styles.commitPressed, { backgroundColor: accent, opacity: enabled || busy ? 1 : 0.5 }]} accessibilityRole="button" accessibilityState={{ disabled: !enabled || busy, busy }}>
      {busy ? <ActivityIndicator color={theme.primaryInk} /> : <Text variant="label" color={theme.primaryInk}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { minWidth: 96, minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, textAlign: 'center', fontSize: 16 },
  commit: { alignSelf: 'flex-end', height: 36, minWidth: 84, paddingHorizontal: 16, borderRadius: Radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  commitPressed: { opacity: 0.85 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: Space.gutterWide - 4, paddingTop: 16, paddingBottom: 24, gap: 16 },
  input: { minHeight: 120 },
  scheduled: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 36, borderRadius: Radius.lg },
  scheduledText: { flex: 1 },
  quoted: { borderWidth: 1, borderRadius: Radius.lg, borderCurve: 'continuous', padding: 12, gap: 4 },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotedName: { flexShrink: 1, fontSize: 14 },
  tiny: { fontSize: 12, lineHeight: 16 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Space.gutter - 4, paddingTop: 4, gap: 8 },
});
