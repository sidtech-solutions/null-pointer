import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { MessageSquarePlus, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { Button } from '@/components/button';
import { ConversationRow } from '@/components/conversation-row';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, Unauthenticated } from '@/lib/client';
import { conversationTitle, summaryKey, targetOf, targetParam } from '@/lib/remotes';
import { bumpRemotesUnread, removeFromInbox, setRemotesUnread } from '@/lib/remotes-cache';
import { toast } from '@/lib/toast';
import type { ConversationSummary, InboxTab } from '@/lib/types';

const InboxPoll = 15_000;

const Tabs: { key: InboxTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'fetched', label: 'Fetched' },
  { key: 'stashed', label: 'Stashed' },
];

const Empty: Record<InboxTab, { fatal: string; hint: string }> = {
  open: { fatal: '$ git remote -v', hint: 'No remotes yet. Push to someone who follows you, and the conversation shows up here.' },
  fetched: { fatal: '$ git fetch', hint: 'No requests fetched. When someone you don’t follow pushes to you, it waits here until you merge or drop it.' },
  stashed: { fatal: '$ git stash list', hint: 'Nothing stashed. A stashed conversation pops back into Open when someone writes.' },
};

/**
 * The inbox: Open, Fetched (while devnull takes requests) and Stashed are pages
 * you swipe between, as on the Log. Only the page showing polls.
 */
export default function RemotesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const pager = useRef<PagerView>(null);
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [requests, setRequests] = useState(0);

  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled: account.status === 'signed-in', staleTime: 60_000 });
  const remotes = me.data?.remotes ?? null;
  const enabled = remotes !== null;

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  const shown = useMemo(() => Tabs.filter((option) => option.key !== 'fetched' || remotes?.requests === true), [remotes?.requests]);
  const tabs = useMemo(() => shown.map((option) => (option.key === 'fetched' && requests > 0 ? { ...option, label: `Fetched (${requests > 99 ? '99+' : requests})` } : option)), [shown, requests]);
  const current = shown[Math.min(index, shown.length - 1)]?.key ?? 'open';

  const turnOn = useMutation({
    mutationFn: () => api.setRemotes(true),
    onSuccess: (fresh) => queryClient.setQueryData(['me'], fresh),
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not turn Remotes on.'),
  });

  const newRemote = (
    <Pressable onPress={() => router.push('/remotes/new')} hitSlop={8} accessibilityRole="button" accessibilityLabel="New remote">
      <MessageSquarePlus size={22} color={theme.ink} strokeWidth={2} />
    </Pressable>
  );

  if (me.isSuccess && !enabled) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.surface }]}>
        <Header title="Remotes" />
        <View style={styles.off}>
          <EmptyState fatal="$ git remote -v">Remotes are off. Turn them on to push messages to people who follow you, and to take theirs.</EmptyState>
          <Button title="Turn on Remotes" busy={turnOn.isPending} onPress={() => turnOn.mutate()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header title="Remotes" right={enabled ? newRemote : undefined} tabs={tabs} active={current} onChange={(key) => pager.current?.setPage(shown.findIndex((option) => option.key === key))} />

      <View style={[styles.searchRow, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.search, { backgroundColor: theme.wash }]}>
          <Search size={16} color={theme.inkMuted} strokeWidth={2} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search names or @handles" placeholderTextColor={theme.inkMuted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={[styles.searchInput, { color: theme.ink }]} accessibilityLabel="Search conversations" />
          {search !== '' && (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={16} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <PagerView ref={pager} style={styles.pager} initialPage={0} onPageSelected={(event) => setIndex(event.nativeEvent.position)}>
        {shown.map((option, position) => (
          <View key={option.key} style={styles.page}>
            <InboxPage tab={option.key} term={term} active={focused && position === index} loading={me.isPending && !me.data} onRequests={setRequests} onRefreshMe={() => me.refetch()} />
          </View>
        ))}
      </PagerView>
    </View>
  );
}

function InboxPage({ tab, term, active, loading, onRequests, onRefreshMe }: { tab: InboxTab; term: string; active: boolean; loading: boolean; onRequests: (count: number) => void; onRefreshMe: () => Promise<unknown> }) {
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['remotes', tab, term],
    queryFn: ({ pageParam }) => api.remotes(tab, term, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? (last.data.at(-1)?.id ?? null) : null),
    enabled: account.status === 'signed-in' && active,
    refetchInterval: active ? InboxPoll : false,
  });

  const first = query.data?.pages[0];

  useEffect(() => {
    if (first && term === '') {
      setRemotesUnread(queryClient, first.unread_count);
      onRequests(first.requests_count ?? 0);
    }
  }, [first, term, queryClient, onRequests]);

  useEffect(() => {
    if (query.error instanceof Unauthenticated) {
      account.signOut().then(() => router.replace('/onboarding'));
    }
  }, [query.error, account, router]);

  const conversations = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const stash = useMutation({
    mutationFn: ({ conversation, stashed }: { conversation: ConversationSummary; stashed: boolean }) => api.stashRemote(targetOf(conversation), stashed),
    onSuccess: (_result, { conversation, stashed }) => {
      removeFromInbox(queryClient, summaryKey(conversation));

      if (stashed && conversation.ahead > 0) {
        bumpRemotesUnread(queryClient, -conversation.ahead);
      }

      queryClient.invalidateQueries({ queryKey: ['remotes'] });
      toast(stashed ? `Stashed ${conversationTitle(conversation, account.user)}.` : `${conversationTitle(conversation, account.user)} is back in Open.`);
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not stash.'),
  });

  const settle = useMutation({
    mutationFn: ({ conversation, merge }: { conversation: ConversationSummary; merge: boolean }) => (merge ? api.mergeRequest(conversation.partner?.username ?? '') : api.dropRequest(conversation.partner?.username ?? '')),
    onSuccess: (_result, { conversation, merge }) => {
      removeFromInbox(queryClient, summaryKey(conversation));
      bumpRemotesUnread(queryClient, -1);
      queryClient.invalidateQueries({ queryKey: ['remotes'] });

      if (merge) {
        router.push({ pathname: '/remotes/[target]', params: { target: targetParam(targetOf(conversation)) } });
      }
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not do that.'),
  });

  const open = (conversation: ConversationSummary) => router.push({ pathname: '/remotes/[target]', params: { target: targetParam(targetOf(conversation)) } });

  const actions = (conversation: ConversationSummary) => {
    const title = conversationTitle(conversation, account.user);
    const options: { label: string; destructive?: boolean; run: () => void }[] = [];

    if (tab === 'fetched' && conversation.partner) {
      options.push({ label: 'Merge request', run: () => settle.mutate({ conversation, merge: true }) });
      options.push({ label: 'Drop request', destructive: true, run: () => settle.mutate({ conversation, merge: false }) });
    } else {
      options.push({ label: conversation.is_archived ? 'Unstash' : 'Stash', run: () => stash.mutate({ conversation, stashed: !conversation.is_archived }) });
    }

    if (conversation.partner) {
      const username = conversation.partner.username;
      options.push({ label: 'View profile', run: () => router.push({ pathname: '/users/[username]', params: { username } }) });
    }

    if (Platform.OS === 'ios') {
      const labels = [...options.map((option) => option.label), 'Cancel'];
      const destructive = options.findIndex((option) => option.destructive);

      ActionSheetIOS.showActionSheetWithOptions({ title, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructive >= 0 ? destructive : undefined }, (index) => options[index]?.run());

      return;
    }

    Alert.alert(title, undefined, [...options.map((option) => ({ text: option.label, style: option.destructive ? ('destructive' as const) : undefined, onPress: option.run })), { text: 'Cancel', style: 'cancel' }]);
  };

  const refresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([query.refetch(), onRefreshMe()]);
    } finally {
      setRefreshing(false);
    }
  };

  const empty = Empty[tab];

  return (
    <View style={styles.page}>
      <FlashList
        data={conversations}
        keyExtractor={(conversation) => summaryKey(conversation)}
        renderItem={({ item }) => <ConversationRow conversation={item} me={account.user} onPress={open} onLongPress={actions} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.inkMuted} />}
        ListEmptyComponent={
          query.isPending || loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          ) : query.isError ? (
            <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
          ) : term !== '' ? (
            <EmptyState fatal={`fatal: nothing matches '${term}'`} />
          ) : (
            <EmptyState fatal={empty.fatal} action={tab === 'open' ? 'New remote' : undefined} onAction={() => router.push('/remotes/new')}>
              {empty.hint}
            </EmptyState>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={theme.inkMuted} />
            </View>
          ) : null
        }
      />
      {tab === 'fetched' && conversations.length > 0 && (
        <View style={[styles.hint, { borderTopColor: theme.hairline, backgroundColor: theme.surface }]}>
          <Text variant="mono" muted style={styles.hintText}>Hold a request to merge or drop it. Dropping is silent.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  off: { alignItems: 'center', gap: 8, paddingBottom: 24 },
  searchRow: { paddingHorizontal: Space.gutter, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: Radius.lg },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  pager: { flex: 1 },
  page: { flex: 1 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  hint: { paddingHorizontal: Space.gutter, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  hintText: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
