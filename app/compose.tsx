import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CodeSuggestion, LanguageSheet, useCodePaste } from '@/components/code-tools';
import { CommitBody } from '@/components/commit-body';
import { DraftPreview } from '@/components/draft-preview';
import { MentionSuggestions } from '@/components/mention-suggestions';
import { AttachmentStrip, BodyCounter, ComposerInput, ComposerToolbar, emptyPoll, PollEditor, pollFits, StashLabel, toUploads, useAttachments } from '@/components/composer';
import { Text } from '@/components/text';
import { laneColor, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import { findCachedCommit, prependCommit } from '@/lib/commit-cache';
import { fits, length, MaxLength, relativeTime, shortHash } from '@/lib/display';
import { useKeyboardShown } from '@/lib/keyboard';
import { insertMention, mentionBeforeCaret, useMentionSuggestions } from '@/lib/mentions';
import { isOnline } from '@/lib/network';
import { enqueue, isOffline } from '@/lib/outbox';
import { sharedText, withShared } from '@/lib/share-target';
import { dropStash, getStash, putStash } from '@/lib/stash';
import { toast } from '@/lib/toast';
import { refreshStreakWidget } from '@/lib/widgets';
import type { NewPoll, User } from '@/lib/types';

export default function ComposeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const { quote } = useLocalSearchParams<{ quote?: string }>();
  const stashName = quote ? `quote-${quote}` : 'composer';
  const [body, setBody] = useState('');
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [poll, setPoll] = useState<NewPoll | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const attachments = useAttachments();
  const keyboardShown = useKeyboardShown();
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const mention = mentionBeforeCaret(body, caret);
  const suggestions = useMentionSuggestions(mention, { quote });

  // The caret is placed once after a pick, then the input is left to itself again.
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

    const next = insertMention(body, mention, user.handle);
    setBody(next.text);
    setCaret(next.caret);
    setSelection({ start: next.caret, end: next.caret });
  };

  // Pasted code is offered a fence; the clipboard can be pasted straight in as one.
  const paste = useCodePaste(body, caret, (text, at) => {
    setBody(text);
    setCaret(at);
    setSelection({ start: at, end: at });
  });

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
    getStash(account.user?.id, stashName).then((draft) => {
      setBody(draft);
      setRestored(draft !== '');
      setReady(true);
    });
  }, [account.user?.id, stashName]);

  useEffect(() => {
    if (ready) {
      putStash(account.user?.id, stashName, body);
    }
  }, [body, ready, account.user?.id, stashName]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBody((current) => withShared(current, text));
      setRestored(false);
    }

    if (files.length > 0) {
      addShared(files);
    }
  }, [ready, share, addShared]);

  const hasImages = attachments.images.length > 0;
  // With images the body may be empty; a poll needs its question. Either way a non-empty body must fit.
  const bodyReady = hasImages && body.trim() === '' ? true : fits(body);
  const canCommit = bodyReady && length(body) <= MaxLength && (poll === null || pollFits(poll));

  const commit = useMutation({
    mutationFn: async () => {
      const { uploads, descriptions } = await toUploads(attachments.images);

      return api.createCommit(body.trim(), { quotedCommitId: quote ?? null, images: uploads, descriptions, poll: poll ? { ...poll, options: poll.options.map((option) => option.trim()) } : null });
    },
    onSuccess: async (created) => {
      await dropStash(account.user?.id, stashName);
      setBody('');
      attachments.clear();
      setPoll(null);
      prependCommit(queryClient, created);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      refreshStreakWidget({ force: true });
      router.back();
      toast(`[log ${created.short_hash || shortHash(created.id)}] ${(created.body || (created.images?.length ? `${created.images.length} ${created.images.length === 1 ? 'image' : 'images'}` : '')).split('\n')[0].slice(0, 60)}`);
    },
    onError: (exception) => {
      if (isOffline(exception)) {
        keepForLater();

        return;
      }

      setError(exception instanceof ApiError ? exception.firstError() : exception instanceof Error && exception.message ? exception.message : 'fatal: could not commit.');
    },
  });

  // No connection: the draft goes to the outbox and is pushed when one comes back.
  const keepForLater = async () => {
    const trimmed = body.trim();

    await enqueue({ body: trimmed, quotedCommitId: quote ?? null, poll: poll ? { ...poll, options: poll.options.map((option) => option.trim()) } : null, images: attachments.images });
    await dropStash(account.user?.id, stashName);
    setBody('');
    attachments.clear();
    setPoll(null);
    router.back();
    toast('Offline. Kept in the outbox; it commits when you are back online.');
  };

  const submit = () => {
    if (!isOnline()) {
      keepForLater();
    } else {
      commit.mutate();
    }
  };

  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;
  const handle = quoted.data?.commit.author?.handle;
  const busy = commit.isPending;

  const cancel = () => {
    if (hasImages || poll) {
      Alert.alert('Discard this commit?', hasImages ? 'Your text is kept, the images are not.' : 'Your text is kept, the poll is not.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);

      return;
    }

    router.back();
  };

  const togglePoll = () => {
    setError(null);
    setPoll((current) => (current ? null : emptyPoll));
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: theme.surface, paddingTop: Platform.OS === 'ios' ? 12 : insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={cancel} disabled={busy} hitSlop={8} style={styles.barButton} accessibilityRole="button" accessibilityHint="Keeps your draft for next time">
          <Text variant="nav">Cancel</Text>
        </Pressable>
        <Text variant="name" numberOfLines={1} style={styles.title}>{quote ? `Quote @${handle ?? ''}` : 'New commit'}</Text>
        <View style={styles.barButton}>
          <Pressable onPress={submit} disabled={!canCommit || busy} style={[styles.commit, { backgroundColor: accent, opacity: canCommit || busy ? 1 : 0.5 }]} accessibilityRole="button" accessibilityState={{ disabled: !canCommit || busy, busy }}>
            {busy ? <ActivityIndicator color={theme.primaryInk} /> : <Text variant="label" color={theme.primaryInk}>Commit</Text>}
          </Pressable>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} style={styles.scroll}>
        {error && <Text variant="small" color={theme.destructive}>{error}</Text>}

        {previewing ? (
          <DraftPreview body={body} author={account.user} images={attachments.images} poll={poll} quoted={quoted.data?.commit ?? null} onOpenMention={(username) => router.push({ pathname: '/users/[username]', params: { username } })} />
        ) : (
          <ComposerInput
            value={body}
            onChangeText={(text) => {
              setBody(text);
              if (text === '') {
                setRestored(false);
              }
            }}
            onSelectionChange={(event) => setCaret(event.nativeEvent.selection.end)}
            selection={selection}
            placeholder={quote ? 'Add your take' : poll ? 'Ask a question' : hasImages ? 'Say something about it (optional)' : 'What did you ship?'}
            autoFocus
            editable={!busy}
            accessibilityLabel="Your commit"
            style={styles.input}
          />
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

      {!previewing && <CodeSuggestion paste={paste} />}
      {!previewing && <MentionSuggestions users={suggestions} onPick={pickMention} />}
      <LanguageSheet paste={paste} />

      <View style={[styles.footer, { borderTopColor: theme.hairline, paddingBottom: keyboardShown ? 4 : Math.max(insets.bottom, 8) }]}>
        <ComposerToolbar attachments={attachments} poll={poll} onTogglePoll={togglePoll} withPoll={!quote} previewing={previewing} onTogglePreview={() => setPreviewing((current) => !current)} onPasteCode={paste.fromClipboard}>
          {restored && (
            <StashLabel
              onDrop={() => {
                setBody('');
                setRestored(false);
                dropStash(account.user?.id, stashName);
              }}
            />
          )}
          <BodyCounter body={body} />
        </ComposerToolbar>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { minWidth: 96, minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, textAlign: 'center', fontSize: 16 },
  commit: { alignSelf: 'flex-end', height: 36, minWidth: 84, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  body: { paddingHorizontal: Space.gutterWide - 4, paddingTop: 16, paddingBottom: 24, gap: 16 },
  input: { minHeight: 120 },
  quoted: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotedName: { flexShrink: 1, fontSize: 14 },
  tiny: { fontSize: 12, lineHeight: 16 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Space.gutter - 4, paddingTop: 4, gap: 8 },
});
