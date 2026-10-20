import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommitBody } from '@/components/commit-body';
import { BodyCounter, ComposerInput, StashLabel } from '@/components/composer';
import { Text } from '@/components/text';
import { laneColor, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import { findCachedCommit, prependCommit } from '@/lib/commit-cache';
import { fits, relativeTime, shortHash } from '@/lib/display';
import { dropStash, getStash, putStash } from '@/lib/stash';
import { toast } from '@/lib/toast';

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

  const commit = useMutation({
    mutationFn: () => api.createCommit(body.trim(), null, quote ?? null),
    onSuccess: async (created) => {
      await dropStash(account.user?.id, stashName);
      setBody('');
      prependCommit(queryClient, created);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.back();
      toast(`[log ${created.short_hash || shortHash(created.id)}] ${created.body.split('\n')[0].slice(0, 60)}`);
    },
    onError: (exception) => setError(exception instanceof ApiError ? exception.firstError() : 'fatal: could not commit.'),
  });

  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;
  const handle = quoted.data?.commit.author?.username;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: theme.surface, paddingTop: Platform.OS === 'ios' ? 12 : insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.barButton} accessibilityRole="button" accessibilityHint="Keeps your draft for next time">
          <Text variant="nav">Cancel</Text>
        </Pressable>
        <Text variant="name" numberOfLines={1} style={styles.title}>{quote ? `Quote @${handle ?? ''}` : 'New commit'}</Text>
        <View style={styles.barButton}>
          <Pressable onPress={() => commit.mutate()} disabled={!fits(body) || commit.isPending} style={[styles.commit, { backgroundColor: accent, opacity: fits(body) && !commit.isPending ? 1 : 0.5 }]} accessibilityRole="button">
            <Text variant="label" color={theme.primaryInk}>Commit</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {error && <Text variant="small" color={theme.destructive}>{error}</Text>}

        <ComposerInput
          value={body}
          onChangeText={(text) => {
            setBody(text);
            if (text === '') {
              setRestored(false);
            }
          }}
          placeholder={quote ? 'Add your take' : 'What did you ship?'}
          autoFocus
          accessibilityLabel="Your commit"
          style={styles.input}
        />

        {quoted.data && (
          <View style={[styles.quoted, { borderColor: theme.hairline }]}>
            <View style={styles.quotedHeader}>
              <Text variant="name" numberOfLines={1} style={styles.quotedName}>{quoted.data.commit.author?.name || handle}</Text>
              <Text variant="mono" muted style={styles.tiny}>@{handle} · {relativeTime(quoted.data.commit.created_at)}</Text>
            </View>
            <CommitBody body={quoted.data.commit.body} size={14} numberOfLines={6} />
          </View>
        )}

        <View style={styles.counterRow}>
          {restored && (
            <StashLabel
              onDrop={() => {
                setBody('');
                setRestored(false);
                dropStash(account.user?.id, stashName);
              }}
            />
          )}
          <View style={styles.spacer} />
          <BodyCounter body={body} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { minWidth: 96, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, textAlign: 'center', fontSize: 16 },
  commit: { alignSelf: 'flex-end', height: 36, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: Space.gutterWide - 4, paddingTop: 16, paddingBottom: 40, gap: 16 },
  input: { minHeight: 120 },
  quoted: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotedName: { flexShrink: 1, fontSize: 14 },
  tiny: { fontSize: 12, lineHeight: 16 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 20 },
  spacer: { flex: 1 },
});
