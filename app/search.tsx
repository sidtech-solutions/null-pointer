import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { api } from '@/lib/client';
import type { User } from '@/lib/types';

/**
 * Find a developer by name or handle, through the web's public people search,
 * since the signed API has none yet. Commit search stays on the web.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 250);

    return () => clearTimeout(timer);
  }, [text]);

  const query = useQuery({
    queryKey: ['user-search', term],
    queryFn: () => api.searchUsers(term),
    enabled: term !== '',
    staleTime: 60_000,
  });

  const open = (user: User) => router.push({ pathname: '/users/[username]', params: { username: user.username } });

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Find a developer</Text>
          </View>
        }
      />

      <View style={[styles.searchRow, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.search, { backgroundColor: theme.wash }]}>
          <Text variant="mono" muted>$ who</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="name or @handle"
            placeholderTextColor={theme.inkMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
            style={[styles.input, { color: theme.ink }]}
            accessibilityLabel="Search developers"
          />
          {text !== '' && (
            <Pressable onPress={() => setText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={16} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <FlashList
        data={query.data ?? []}
        keyExtractor={(user) => String(user.id ?? user.username)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={[styles.row, { borderBottomColor: theme.hairline }]} accessibilityRole="button" accessibilityLabel={`@${item.username}`}>
            <Avatar user={item} size={40} lane={laneColor(theme, item.lane)} />
            <View style={styles.column}>
              <Text variant="name" numberOfLines={1}>{item.name || item.username}</Text>
              <Text variant="mono" muted numberOfLines={1}>@{item.username}</Text>
              {item.bio ? <Text variant="small" numberOfLines={2}>{item.bio}</Text> : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          term === '' ? (
            <View style={styles.hint}>
              <Text variant="small" muted style={styles.hintText}>Type a name or a GitHub handle. Commit search is on dev-null.sh.</Text>
            </View>
          ) : query.isPending ? (
            <View style={styles.hint}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          ) : query.isError ? (
            <EmptyState fatal={query.error.message} action="Try again" onAction={() => query.refetch()} />
          ) : (
            <EmptyState fatal={`fatal: no one matches '${term}'`} />
          )
        }
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  column: { flex: 1, gap: 2 },
  hint: { paddingVertical: 32, paddingHorizontal: Space.gutterWide, alignItems: 'center' },
  hintText: { textAlign: 'center' },
});
