import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowRight, ChevronLeft, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { api } from '@/lib/client';
import { relativeTime } from '@/lib/display';
import { useNow } from '@/lib/now';
import type { CommitHit, User } from '@/lib/types';

const FewCommits = 5;
const AllCommits = 100;

type Row =
  | { type: 'heading'; key: string; label: string }
  | { type: 'user'; key: string; user: User }
  | { type: 'commit'; key: string; commit: CommitHit }
  | { type: 'more'; key: string }
  | { type: 'note'; key: string; text: string };

/**
 * Find a developer by name or handle, or commits by meaning, through the
 * web's public search, since the signed API has neither. Like the web's
 * dialog: people first, then the most relevant commits, with a way to see
 * them all.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const now = useNow();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [all, setAll] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(text.trim());
      setAll(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [text]);

  const people = useQuery({
    queryKey: ['user-search', term],
    queryFn: () => api.searchUsers(term),
    enabled: term !== '',
    staleTime: 60_000,
  });

  // Commit search is by meaning and limited to 15 a minute, so it waits for three characters and the pause above.
  const longEnough = Array.from(term).length >= 3;
  const commits = useQuery({
    queryKey: ['commit-search', term],
    queryFn: () => api.searchCommits(term, AllCommits),
    enabled: longEnough,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

    if (people.data && people.data.length > 0) {
      out.push({ type: 'heading', key: 'h-people', label: 'Developers' });
      people.data.forEach((user) => out.push({ type: 'user', key: `u-${user.id ?? user.handle}`, user }));
    }

    if (longEnough) {
      if (commits.data && commits.data.length > 0) {
        out.push({ type: 'heading', key: 'h-commits', label: all ? 'Matching commits' : 'Most relevant commits' });
        (all ? commits.data : commits.data.slice(0, FewCommits)).forEach((commit) => out.push({ type: 'commit', key: `c-${commit.id}`, commit }));

        if (!all && commits.data.length > FewCommits) {
          out.push({ type: 'more', key: 'more' });
        }
      } else if (commits.isError) {
        out.push({ type: 'note', key: 'commits-error', text: commits.error.message });
      }
    } else if (term !== '') {
      out.push({ type: 'note', key: 'short', text: 'Type three characters or more to search commits by meaning.' });
    }

    return out;
  }, [people.data, commits.data, commits.isError, commits.error, longEnough, term, all]);

  const openUser = (user: Pick<User, 'handle'>) => router.push({ pathname: '/users/[username]', params: { username: user.handle } });
  const openCommit = (commit: CommitHit) => router.push({ pathname: '/commits/[id]', params: { id: commit.id } });
  const searching = term !== '' && (people.isPending || (longEnough && commits.isPending));
  const nothing = term !== '' && !searching && rows.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Search</Text>
          </View>
        }
      />

      <View style={[styles.searchRow, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.search, { backgroundColor: theme.wash }]}>
          <Text variant="mono" muted>$ grep</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="a developer, or what a commit is about"
            placeholderTextColor={theme.inkMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
            style={[styles.input, { color: theme.ink }]}
            accessibilityLabel="Search developers and commits"
          />
          {text !== '' && (
            <Pressable onPress={() => setText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={16} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          switch (item.type) {
            case 'heading':
              return (
                <Text variant="mono" muted style={styles.heading}>{item.label}</Text>
              );
            case 'user':
              return (
                <Pressable onPress={() => openUser(item.user)} style={[styles.row, { borderBottomColor: theme.hairline }]} accessibilityRole="button" accessibilityLabel={`@${item.user.handle}`}>
                  <Avatar user={item.user} size={40} lane={laneColor(theme, item.user.lane)} />
                  <View style={styles.column}>
                    <Text variant="name" numberOfLines={1}>{item.user.name || item.user.handle}</Text>
                    <Text variant="mono" muted numberOfLines={1}>@{item.user.handle}</Text>
                    {item.user.bio ? <Text variant="small" numberOfLines={2}>{item.user.bio}</Text> : null}
                  </View>
                </Pressable>
              );
            case 'commit':
              return (
                <Pressable onPress={() => openCommit(item.commit)} style={[styles.row, { borderBottomColor: theme.hairline }]} accessibilityRole="button" accessibilityHint="Opens the commit">
                  {item.commit.user ? <Avatar user={item.commit.user} size={36} lane={laneColor(theme, item.commit.user.lane)} /> : <View style={styles.avatarGap} />}
                  <View style={styles.column}>
                    <View style={styles.meta}>
                      {item.commit.user && (
                        <Pressable onPress={() => openUser(item.commit.user!)} hitSlop={6}>
                          <Text variant="mono" muted numberOfLines={1}>@{item.commit.user.handle}</Text>
                        </Pressable>
                      )}
                      <Text variant="mono" muted>· {relativeTime(item.commit.created_at, now)}</Text>
                    </View>
                    <Text numberOfLines={3} style={styles.body}>{item.commit.body}</Text>
                  </View>
                </Pressable>
              );
            case 'more':
              return (
                <Pressable onPress={() => setAll(true)} style={styles.more} accessibilityRole="button">
                  <Text variant="small" color={theme.primary}>See all matching commits</Text>
                  <ArrowRight size={14} color={theme.primary} strokeWidth={2} />
                </Pressable>
              );
            case 'note':
              return (
                <Text variant="small" muted style={styles.note}>{item.text}</Text>
              );
          }
        }}
        ListEmptyComponent={
          term === '' ? (
            <View style={styles.hint}>
              <Text variant="small" muted style={styles.hintText}>A name or handle finds developers. A few words find commits about that, by meaning.</Text>
            </View>
          ) : searching ? (
            <View style={styles.hint}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          ) : people.isError && commits.isError ? (
            <EmptyState fatal={people.error.message} action="Try again" onAction={() => { people.refetch(); commits.refetch(); }} />
          ) : nothing ? (
            <EmptyState fatal={`fatal: nothing matches '${term}'`} />
          ) : null
        }
        ListFooterComponent={rows.length > 0 && searching ? <ActivityIndicator color={theme.inkMuted} style={styles.footer} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  searchRow: { paddingHorizontal: Space.gutter, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: Radius.lg },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  heading: { fontSize: 12, lineHeight: 16, paddingHorizontal: Space.gutter, paddingTop: 16, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  column: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { fontSize: 15, lineHeight: 22 },
  avatarGap: { width: 36 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Space.gutter, paddingVertical: 14 },
  note: { paddingHorizontal: Space.gutter, paddingVertical: 12 },
  hint: { paddingVertical: 32, paddingHorizontal: Space.gutterWide, alignItems: 'center' },
  hintText: { textAlign: 'center' },
  footer: { paddingVertical: 16 },
});
