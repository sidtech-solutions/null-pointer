import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { api, ApiError } from '@/lib/client';
import { useKeyboardShown } from '@/lib/keyboard';
import { targetParam } from '@/lib/remotes';
import { type Candidate, OrgLimits, type User } from '@/lib/types';

type Mode = 'remote' | 'org';

const Modes: { key: Mode; label: string }[] = [
  { key: 'remote', label: 'Remote' },
  { key: 'org', label: 'Org' },
];

/** Picks someone to push to, a few people and a name for a new org, or, with `org`, people to add to that org. */
export default function NewRemoteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardShown = useKeyboardShown();
  const queryClient = useQueryClient();
  const { org } = useLocalSearchParams<{ org?: string }>();
  const adding = typeof org === 'string' && org !== '';
  const [mode, setMode] = useState<Mode>(adding ? 'org' : 'remote');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [shareHistory, setShareHistory] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  const candidates = useQuery({
    queryKey: ['remote-candidates', mode, term, adding ? org : null],
    queryFn: () => api.remoteCandidates(term, { forOrg: mode === 'org', org: adding ? org : null }),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const add = useMutation({
    mutationFn: () => api.addOrgMembers(org ?? '', picked.map((user) => user.handle), shareHistory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remote-thread'] });
      queryClient.invalidateQueries({ queryKey: ['remotes'] });
      router.back();
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not add them.'),
  });

  const create = useMutation({
    mutationFn: () => api.createOrg(name, picked.map((user) => user.handle)),
    onSuccess: (id) => {
      if (id === '') {
        router.back();

        return;
      }

      router.replace({ pathname: '/remotes/[target]', params: { target: targetParam({ kind: 'org', id }) } });
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not start the org.'),
  });

  const pickedIds = useMemo(() => new Set(picked.map((user) => String(user.id))), [picked]);

  const choose = (candidate: Candidate) => {
    if (candidate.reason) {
      return;
    }

    if (mode === 'remote') {
      router.replace({ pathname: '/remotes/[target]', params: { target: targetParam({ kind: 'direct', handle: candidate.user.handle }) } });

      return;
    }

    setPicked((list) => (pickedIds.has(String(candidate.user.id)) ? list.filter((user) => String(user.id) !== String(candidate.user.id)) : list.length < OrgLimits.maxMembers - 1 ? [...list, candidate.user] : list));
  };

  const list = candidates.data ?? [];
  const canCreate = picked.length > 0 && name.length <= OrgLimits.maxNameLength && !create.isPending;
  const canAdd = picked.length > 0 && !add.isPending;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>{adding ? 'Add people' : mode === 'remote' ? 'New remote' : 'New org'}</Text>
          </View>
        }
        tabs={adding ? undefined : Modes}
        active={mode}
        onChange={setMode}
      />

      <View style={[styles.searchRow, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.search, { backgroundColor: theme.wash }]}>
          <Search size={16} color={theme.inkMuted} strokeWidth={2} />
          <TextInput value={search} onChangeText={setSearch} placeholder={mode === 'remote' ? 'Who do you want to push to?' : 'Add people'} placeholderTextColor={theme.inkMuted} autoCapitalize="none" autoCorrect={false} autoFocus style={[styles.searchInput, { color: theme.ink }]} accessibilityLabel="Search people" />
          {search !== '' && (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={16} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
        {mode === 'org' && picked.length > 0 && (
          <View style={styles.picked}>
            {picked.map((user) => (
              <Pressable key={String(user.id)} onPress={() => setPicked((current) => current.filter((candidate) => String(candidate.id) !== String(user.id)))} style={[styles.chip, { backgroundColor: theme.primarySoft }]} accessibilityRole="button" accessibilityLabel={`Remove @${user.handle}`}>
                <Text variant="mono" color={theme.primary} style={styles.chipText}>@{user.handle}</Text>
                <X size={12} color={theme.primary} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <FlashList
        data={list}
        keyExtractor={(candidate) => String(candidate.user.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const disabled = item.reason !== null;
          const selected = pickedIds.has(String(item.user.id));

          return (
            <Pressable
              onPress={() => choose(item)}
              disabled={disabled}
              android_ripple={{ color: theme.wash }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.wash : theme.surface, borderBottomColor: theme.hairline, opacity: disabled ? 0.55 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              accessibilityLabel={`${item.user.name || item.user.handle}, @${item.user.handle}${item.reason ? `, ${item.reason}` : ''}`}>
              <Avatar user={item.user} size={40} lane={laneColor(theme, item.user.lane)} />
              <View style={styles.names}>
                <Text variant="name" numberOfLines={1}>{item.user.name || item.user.handle}</Text>
                <Text variant="mono" muted numberOfLines={1} style={styles.small}>@{item.user.handle}{item.reason ? ` · ${item.reason}` : ''}</Text>
              </View>
              {mode === 'org' && !disabled && (
                <View style={[styles.check, { borderColor: selected ? theme.primary : theme.rail, backgroundColor: selected ? theme.primary : 'transparent' }]}>
                  {selected && <Check size={14} color={theme.primaryInk} strokeWidth={3} />}
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          candidates.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          ) : candidates.isError ? (
            <EmptyState fatal={candidates.error.message} action="Try again" onAction={() => candidates.refetch()} />
          ) : (
            <EmptyState fatal={term === '' ? '$ git remote add' : `fatal: nobody matches '${term}'`}>{term === '' ? 'Search for someone by name or @handle. You can push to people who follow you.' : ''}</EmptyState>
          )
        }
      />

      {adding ? (
        <View style={[styles.footer, { borderTopColor: theme.hairline, backgroundColor: theme.surface, paddingBottom: keyboardShown ? 8 : Math.max(insets.bottom, 8) }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text variant="label">Share the history</Text>
              <Text variant="small" muted>They see everything pushed so far. Off, only what comes after they join.</Text>
            </View>
            <Switch value={shareHistory} onValueChange={setShareHistory} trackColor={{ true: theme.primary }} accessibilityLabel="Share the history" />
          </View>
          <Button title={picked.length === 0 ? 'Add people' : `Add ${picked.length}`} busy={add.isPending} disabled={!canAdd} onPress={() => add.mutate()} />
        </View>
      ) : (
        mode === 'org' && (
          <View style={[styles.footer, { borderTopColor: theme.hairline, backgroundColor: theme.surface, paddingBottom: keyboardShown ? 8 : Math.max(insets.bottom, 8) }]}>
            <TextInput value={name} onChangeText={setName} placeholder="Org name (optional)" placeholderTextColor={theme.inkMuted} maxLength={OrgLimits.maxNameLength} style={[styles.nameInput, { color: theme.ink, backgroundColor: theme.wash }]} accessibilityLabel="Org name" />
            <Button title={picked.length === 0 ? 'Create org' : `Create org with ${picked.length}`} busy={create.isPending} disabled={!canCreate} onPress={() => create.mutate()} />
          </View>
        )
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15 },
  searchRow: { paddingHorizontal: Space.gutter, paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: Radius.lg },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  picked: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: Radius.full },
  chipText: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Space.gutter, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60 },
  names: { flex: 1 },
  small: { fontSize: 12, lineHeight: 16 },
  check: { width: 24, height: 24, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  loading: { paddingVertical: 32, alignItems: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Space.gutter, paddingTop: 8, gap: 8 },
  nameInput: { height: 40, paddingHorizontal: 12, borderRadius: Radius.lg, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { flex: 1 },
});
