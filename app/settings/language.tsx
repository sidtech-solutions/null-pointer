import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { SettingsHeading } from '@/components/settings-heading';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import { deviceLanguage, deviceTimezone } from '@/lib/translation';
import type { TranslationLanguage, UserSettings } from '@/lib/types';

/** Time zone and translation, as the web's settings save them. */
export default function LanguageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');

  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.settings(), enabled: account.status === 'signed-in', staleTime: 5 * 60_000 });
  const data = settings.data;
  const phoneZone = deviceTimezone();
  const phoneLanguage = deviceLanguage();

  const failed = (error: unknown, fallback: string) => {
    Alert.alert(error instanceof ApiError ? error.firstError() : fallback);
    queryClient.invalidateQueries({ queryKey: ['settings'] });
  };

  const patch = (change: Partial<UserSettings>) => queryClient.setQueryData<UserSettings>(['settings'], (current) => (current ? { ...current, ...change } : current));

  const timezone = useMutation({
    mutationFn: ({ zone, showLocalTime }: { zone: string | null; showLocalTime: boolean }) => api.saveTimezone(zone, showLocalTime),
    onMutate: ({ zone, showLocalTime }) => patch({ timezone: zone, show_local_time: showLocalTime }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', account.user?.handle] }),
    onError: (error) => failed(error, 'fatal: could not save the time zone.'),
  });

  const automatic = useMutation({
    mutationFn: (enabled: boolean) => api.setAutomaticTranslation(enabled),
    onMutate: (enabled) => patch({ automatic_translation: enabled }),
    onError: (error) => failed(error, 'fatal: could not change automatic translation.'),
  });

  const language = useMutation({
    mutationFn: (code: string | null) => api.setTranslationLanguage(code),
    onMutate: (code) => patch({ translation_language: code }),
    onError: (error) => failed(error, 'fatal: could not save the language.'),
  });

  const languages = useMemo(() => data?.translation_languages ?? [], [data?.translation_languages]);
  const chosen = languages.find((candidate) => candidate.code === data?.translation_language) ?? null;
  const phoneName = languages.find((candidate) => candidate.code === phoneLanguage)?.name ?? phoneLanguage;

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return needle === '' ? languages : languages.filter((candidate) => candidate.name.toLowerCase().includes(needle) || candidate.native_name.toLowerCase().includes(needle) || candidate.code === needle);
  }, [languages, search]);

  const pick = (candidate: TranslationLanguage | null) => {
    language.mutate(candidate?.code ?? null);
    setChoosing(false);
    setSearch('');
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Language and time</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Space.gutterWide }]}>
        {settings.isPending && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.inkMuted} />
          </View>
        )}

        {settings.isError && <EmptyState fatal={settings.error.message} action="Try again" onAction={() => settings.refetch()} />}

        {data && (
          <>
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
              <SettingsHeading title="Time zone" description="Your profile can show your local time, so people know when to expect you. Saved from this phone's clock; nothing is tracked." />
              <View style={[styles.field, { borderColor: theme.hairline }]}>
                <Text variant="mono" muted style={styles.key}>saved</Text>
                <Text variant="mono" style={styles.shrink}>{data.timezone ?? 'none'}</Text>
              </View>
              <View style={styles.buttons}>
                {phoneZone && phoneZone !== data.timezone && <Button title={`Use ${phoneZone}`} size="sm" busy={timezone.isPending} onPress={() => timezone.mutate({ zone: phoneZone, showLocalTime: data.show_local_time })} />}
                {data.timezone && <Button title="Forget time zone" size="sm" variant="outline" busy={timezone.isPending} onPress={() => timezone.mutate({ zone: null, showLocalTime: false })} />}
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.shrink}>
                  <Text variant="label">Show my local time</Text>
                  <Text variant="small" muted>On your profile, next to where you are.</Text>
                </View>
                <Switch value={data.show_local_time} onValueChange={(value) => timezone.mutate({ zone: data.timezone ?? phoneZone, showLocalTime: value })} trackColor={{ true: theme.primary }} disabled={timezone.isPending || (!data.timezone && !phoneZone)} accessibilityLabel="Show my local time" />
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
              <SettingsHeading title="Translation" description="Translate from a commit's menu. Commits are translated into this language; the phone's own unless you pick one." />
              <Pressable onPress={() => setChoosing(true)} style={[styles.link, { borderColor: theme.hairline }]} accessibilityRole="button" accessibilityLabel="Translation language">
                <View style={styles.shrink}>
                  <Text variant="nav">Translate into</Text>
                  <Text variant="small" muted numberOfLines={1}>{chosen ? `${chosen.name}${chosen.native_name && chosen.native_name !== chosen.name ? ` · ${chosen.native_name}` : ''}` : `Phone's language (${phoneName})`}</Text>
                </View>
                <Text variant="mono" muted>{chosen?.code ?? phoneLanguage}</Text>
              </Pressable>
              <View style={styles.toggleRow}>
                <View style={styles.shrink}>
                  <Text variant="label">Automatic translation</Text>
                  <Text variant="small" muted>On the web, commits in other languages are translated as you read. The app translates when you ask.</Text>
                </View>
                <Switch value={data.automatic_translation} onValueChange={(value) => automatic.mutate(value)} trackColor={{ true: theme.primary }} disabled={automatic.isPending} accessibilityLabel="Automatic translation" />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Sheet visible={choosing} onClose={() => setChoosing(false)} style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text variant="section" style={styles.grow}>Translate into</Text>
              <Pressable onPress={() => setChoosing(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                <X size={20} color={theme.inkMuted} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: theme.wash }]}>
              <Search size={16} color={theme.inkMuted} strokeWidth={2} />
              <TextInput value={search} onChangeText={setSearch} placeholder="English or native name" placeholderTextColor={theme.inkMuted} autoCapitalize="none" autoCorrect={false} style={[styles.searchInput, { color: theme.ink }]} accessibilityLabel="Search languages" />
            </View>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {search.trim() === '' && (
                <Pressable onPress={() => pick(null)} style={[styles.option, { borderBottomColor: theme.hairline }]} accessibilityRole="radio" accessibilityState={{ checked: !chosen }}>
                  <View style={styles.grow}>
                    <Text>Phone&apos;s language</Text>
                    <Text variant="small" muted>{phoneName}, automatic</Text>
                  </View>
                  {!chosen && <Check size={18} color={theme.primary} strokeWidth={2} />}
                </Pressable>
              )}
              {shown.map((candidate) => {
                const selected = candidate.code === chosen?.code;

                return (
                  <Pressable key={candidate.code} onPress={() => pick(candidate)} style={[styles.option, { borderBottomColor: theme.hairline }]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                    <View style={styles.grow}>
                      <Text>{candidate.name}</Text>
                      {candidate.native_name && candidate.native_name !== candidate.name ? <Text variant="small" muted>{candidate.native_name}</Text> : null}
                    </View>
                    <Text variant="mono" muted>{candidate.code}</Text>
                    {selected && <Check size={18} color={theme.primary} strokeWidth={2} />}
                  </Pressable>
                );
              })}
              {shown.length === 0 && <Text variant="small" muted style={styles.none}>No language matches &ldquo;{search.trim()}&rdquo;.</Text>}
            </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  content: { padding: Space.gutter, gap: 12 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  section: { padding: Space.gutter, gap: 12, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: Radius.lg },
  key: { width: 56 },
  shrink: { flexShrink: 1, flex: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: Radius.lg },
  sheet: { paddingTop: 16, paddingHorizontal: Space.gutter, gap: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: Radius.lg },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  list: { flexGrow: 0 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  none: { paddingVertical: 16, textAlign: 'center' },
});
