import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Image } from 'expo-image';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { RailDot } from '@/components/graph-rail';
import { Header } from '@/components/header';
import { SettingsHeading } from '@/components/settings-heading';
import { Text } from '@/components/text';
import { Fonts, LaneCount, laneColor, Radius, setThemePreference, Space, type ThemePreference, themePreference, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, baseUrl } from '@/lib/client';
import { relativeTime } from '@/lib/display';
import { existingKey, forgetKey } from '@/lib/device-key';
import { useNow } from '@/lib/now';
import type { Lane, RemotesFrom } from '@/lib/types';
import { openLink } from '@/lib/links';

const LaneNames = ['Orange', 'Green', 'Violet', 'Teal', 'Rose', 'Ochre'];

type Choice = 'auto' | number | string;

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const now = useNow();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled: account.status === 'signed-in' });
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [custom, setCustom] = useState('');
  const [preference, setPreference] = useState<ThemePreference>(themePreference);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    existingKey().then((key) => setFingerprint(key?.fingerprint() ?? null));
  }, []);

  const current: Choice = me.data ? (me.data.preferred_lane === null ? 'auto' : me.data.preferred_lane) : 'auto';
  const choice = chosen ?? current;
  const automatic = me.data?.automatic_lane ?? 0;
  const previewLane: Lane = choice === 'auto' ? automatic : choice;
  const previewColor = laneColor(theme, previewLane);
  const changed = chosen !== null && chosen !== current;

  const failed = (error: unknown, fallback: string) => Alert.alert(error instanceof ApiError ? error.firstError() : fallback);

  const sync = useMutation({
    mutationFn: () => api.syncGitHub(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => failed(error, 'fatal: could not sync from GitHub.'),
  });

  const saveLane = useMutation({
    mutationFn: () => (choice === 'auto' ? api.saveLane(null) : typeof choice === 'number' ? api.saveLane(choice) : api.saveLane(null, choice)),
    onSuccess: async () => {
      setChosen(null);
      const fresh = await queryClient.fetchQuery({ queryKey: ['me'], queryFn: () => api.me() });
      await account.signIn(fresh.user);
      queryClient.invalidateQueries({ queryKey: ['log'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => failed(error, 'fatal: could not save the color.'),
  });

  const pasteis = useMutation({
    mutationFn: (enabled: boolean) => api.setPasteisMode(enabled),
    onMutate: (enabled) => queryClient.setQueryData(['me'], (data: typeof me.data) => (data ? { ...data, pasteis_mode: enabled } : data)),
    onError: (error, enabled) => {
      queryClient.setQueryData(['me'], (data: typeof me.data) => (data ? { ...data, pasteis_mode: !enabled } : data));
      failed(error, 'fatal: could not change pastéis mode.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  const remotes = me.data?.remotes ?? null;

  const remotesSwitch = useMutation({
    mutationFn: (enabled: boolean) => api.setRemotes(enabled),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['me'], fresh);
      queryClient.invalidateQueries({ queryKey: ['remotes'] });
    },
    onError: (error) => failed(error, 'fatal: could not change Remotes.'),
  });

  const remotePreferences = useMutation({
    mutationFn: ({ from, pullReceipts }: { from: RemotesFrom; pullReceipts: boolean }) => api.setRemotePreferences(from, pullReceipts),
    onMutate: ({ from, pullReceipts }) => queryClient.setQueryData(['me'], (data: typeof me.data) => (data?.remotes ? { ...data, remotes: { ...data.remotes, from, pull_receipts: pullReceipts } } : data)),
    onSuccess: (fresh) => queryClient.setQueryData(['me'], fresh),
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      failed(error, 'fatal: could not save the Remotes settings.');
    },
  });

  const pickTheme = (next: ThemePreference) => {
    setPreference(next);
    setThemePreference(next);
  };

  const signOut = () =>
    Alert.alert('Sign out?', 'Deletes the key from this phone and signs you out. Signing in again makes a new key for dev-null.sh to approve.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await forgetKey();
          await account.signOut();
          router.replace('/onboarding');
        },
      },
    ]);

  const deleteAccount = () =>
    Alert.alert('Delete your account?', "Everything you committed goes with it. There's no undo.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAccount();
            await forgetKey();
            await account.signOut();
            router.replace('/onboarding');
          } catch (error) {
            failed(error, 'fatal: could not delete the account.');
          }
        },
      },
    ]);

  const user = me.data?.user ?? account.user;
  const deviceName = `devnull on ${Device.modelName ?? 'this phone'}`;
  const customHex = /^#[0-9a-f]{6}$/i.test(custom) ? custom.toLowerCase() : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Settings</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <SettingsHeading title="Profile information" description="Mirrored from GitHub when you sign in. To change any of it, change it on GitHub, then sync it here." />
          {user && (
            <View style={styles.identity}>
              <Avatar user={user} size={48} lane={previewColor} />
              <View style={styles.shrink}>
                <Text variant="name">{user.name || user.username}</Text>
                <Text variant="mono" muted>@{user.username}</Text>
              </View>
            </View>
          )}
          <View style={styles.buttons}>
            <Button title="Edit on GitHub" onPress={() => openLink('https://github.com/settings/profile')} />
            <Button title="Sync from GitHub" variant="outline" busy={sync.isPending} onPress={() => sync.mutate()} />
          </View>
          <Text variant="small" muted>
            {me.data?.github_synced_at ? `Last synced ${relativeTime(me.data.github_synced_at, now)}${relativeTime(me.data.github_synced_at, now) === 'now' ? '' : ' ago'}` : 'Last synced when you signed in'}
          </Text>
        </Section>

        <Section>
          <SettingsHeading title="Color" description="Your lane on the graph: the ring around your avatar, the dot before your handle, and the line your commits hang from." />
          <View style={styles.preview}>
            <RailDot lane={previewColor} />
            {user && <Avatar user={user} size={40} lane={previewColor} />}
            <View style={styles.handle}>
              <View style={[styles.dot, { backgroundColor: previewColor }]} />
              <Text variant="mono" muted>@{user?.username}</Text>
            </View>
          </View>
          <View style={styles.swatches}>
            <Swatch label="Auto" color={laneColor(theme, automatic)} dashed selected={choice === 'auto'} onPress={() => setChosen('auto')} />
            {Array.from({ length: LaneCount }, (_, lane) => (
              <Swatch key={lane} label={LaneNames[lane]} color={theme.lanes[lane]} selected={choice === lane} onPress={() => setChosen(lane)} />
            ))}
          </View>
          <View style={styles.customRow}>
            <View style={[styles.customSwatch, { backgroundColor: customHex ?? theme.wash, borderColor: typeof choice === 'string' ? theme.ink : 'transparent' }]} />
            <TextInput
              value={custom}
              onChangeText={(text) => {
                setCustom(text);
                if (/^#[0-9a-f]{6}$/i.test(text)) {
                  setChosen(text.toLowerCase());
                }
              }}
              placeholder={typeof current === 'string' ? current : '#rrggbb custom color'}
              placeholderTextColor={theme.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              style={[styles.customInput, { color: theme.ink, borderColor: theme.rail, backgroundColor: theme.surface }]}
              accessibilityLabel="Custom color"
            />
          </View>
          <Button title="Save color" disabled={!changed} busy={saveLane.isPending} onPress={() => saveLane.mutate()} style={[styles.save, changed && { backgroundColor: previewColor }]} />
        </Section>

        <Section>
          <SettingsHeading title="Theme" description="System follows your phone, light by day and dark by night if that's how you have it set." />
          <View style={[styles.segments, { borderColor: theme.hairline }]}>
            {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
              <Pressable key={option} onPress={() => pickTheme(option)} style={[styles.segment, preference === option && { backgroundColor: theme.primarySoft }]} accessibilityRole="radio" accessibilityState={{ checked: preference === option }}>
                <Text variant="nav" color={preference === option ? theme.primary : theme.inkMuted}>{option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section>
          <View style={styles.toggleRow}>
            <View style={styles.shrink}>
              <Text variant="section">Pastéis mode</Text>
              <Text variant="small" muted>Give a pastel de nata to commits you like, a few a day, and see how many others have been given.</Text>
            </View>
            <Switch value={me.data?.pasteis_mode ?? false} onValueChange={(value) => pasteis.mutate(value)} trackColor={{ true: theme.primary }} disabled={!me.data} accessibilityLabel="Pastéis mode" />
          </View>
        </Section>

        <Section>
          <View style={styles.toggleRow}>
            <View style={styles.shrink}>
              <Text variant="section">Remotes</Text>
              <Text variant="small" muted>Push messages to people and take theirs. While off, nobody can push to you and your conversations wait for you to come back.</Text>
            </View>
            <Switch value={remotes !== null} onValueChange={(value) => remotesSwitch.mutate(value)} trackColor={{ true: theme.primary }} disabled={!me.data || remotesSwitch.isPending} accessibilityLabel="Remotes" />
          </View>
          {remotes && (
            <>
              <View style={styles.shrink}>
                <Text variant="label">Who can push to you</Text>
                <Text variant="small" muted>
                  {remotes.everyone ? '' : 'People you follow. '}
                  {remotes.requests ? 'Anyone else can push once; their request waits in Fetched until you merge it.' : 'Anyone else gets told you don’t follow them yet.'}
                </Text>
              </View>
              {remotes.everyone && (
                <View style={[styles.segments, { borderColor: theme.hairline }]}>
                  {(['following', 'everyone'] as RemotesFrom[]).map((option) => (
                    <Pressable key={option} onPress={() => remotePreferences.mutate({ from: option, pullReceipts: remotes.pull_receipts })} style={[styles.segment, remotes.from === option && { backgroundColor: theme.primarySoft }]} accessibilityRole="radio" accessibilityState={{ checked: remotes.from === option }}>
                      <Text variant="nav" color={remotes.from === option ? theme.primary : theme.inkMuted}>{option === 'following' ? 'People you follow' : 'Everyone'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.toggleRow}>
                <View style={styles.shrink}>
                  <Text variant="label">Share pulls</Text>
                  <Text variant="small" muted>Let people see when you’ve read their messages, and see when they’ve read yours. Only shows when both of you share.</Text>
                </View>
                <Switch value={remotes.pull_receipts} onValueChange={(value) => remotePreferences.mutate({ from: remotes.from, pullReceipts: value })} trackColor={{ true: theme.primary }} disabled={remotePreferences.isPending} accessibilityLabel="Share pulls" />
              </View>
            </>
          )}
        </Section>

        <Section>
          <SettingsHeading title="Safety" description="The people you mute and block." />
          <Pressable onPress={() => router.push('/settings/safety')} style={[styles.link, { borderColor: theme.hairline, backgroundColor: theme.surface }]} accessibilityRole="button">
            <Text variant="nav">Muted and blocked</Text>
            <ChevronRight size={18} color={theme.inkMuted} strokeWidth={2} />
          </Pressable>
        </Section>

        <Section>
          <SettingsHeading title="This device" description="This phone has its own SSH key. dev-null.sh approved it for your account when you signed in." />
          <View style={[styles.fields, { borderColor: theme.hairline, backgroundColor: theme.surface }]}>
            <Field label="name" value={deviceName} />
            <Field label="key" value={fingerprint} />
            <Field label="remote" value={baseUrl()} last />
          </View>
          <Button title="Manage devices on dev-null.sh" variant="outline" onPress={() => openLink(`${baseUrl()}/settings/devices`)} />
          <Button title="Sign out" variant="outline" onPress={signOut} />
          <Text variant="small" muted style={styles.hint}>Deletes the key from this phone and signs you out.</Text>
        </Section>

        <Section>
          <SettingsHeading title="Delete account" description="Deletes your account, your commits, and this phone's key. There's no undo." />
          <Button title="Delete account" variant="destructive" onPress={deleteAccount} />
        </Section>

        {__DEV__ && (
          <Section>
            <SettingsHeading title="GIF test (dev only)" description="An animated GIF straight from Wikimedia, to prove the image pipeline animates. devnull itself re-encodes uploads to static WebP." />
            <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif' }} style={{ width: 200, height: 200, alignSelf: 'center' }} contentFit="contain" autoplay />
          </Section>
        )}

        <View style={styles.foot}>
          <RefreshCw size={12} color={theme.inkMuted} strokeWidth={2} />
          <Text variant="mono" muted style={styles.footText}>null-pointer · {Device.osName} {Device.osVersion}</Text>
          <Smartphone size={12} color={theme.inkMuted} strokeWidth={2} />
          <ArrowUpRight size={12} color="transparent" />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>{children}</View>;
}

function Swatch({ label, color, selected, dashed = false, onPress }: { label: string; color: string; selected: boolean; dashed?: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={styles.swatch} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label}>
      <View style={[styles.swatchRing, { borderColor: selected ? color : 'transparent' }]}>
        <View style={[styles.swatchGap, { backgroundColor: theme.surface }]}>
          <View style={[styles.swatchDisc, dashed ? { borderWidth: 2, borderStyle: 'dashed', borderColor: color } : { backgroundColor: color }]} />
        </View>
      </View>
      <Text variant="small" muted={!selected} style={styles.swatchLabel}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, last = false }: { label: string; value: string | null; last?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.field, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }]}>
      <Text variant="mono" muted style={styles.key}>{label}</Text>
      {value === null ? <Text variant="mono" muted>null</Text> : <Text variant="small" style={styles.shrink} numberOfLines={2}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  content: { padding: Space.gutter, gap: 12, paddingBottom: 48 },
  section: { padding: Space.gutter, gap: 12, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shrink: { flexShrink: 1, flex: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  handle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  swatch: { alignItems: 'center', gap: 4, width: 64 },
  swatchRing: { width: 36, height: 36, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchGap: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  swatchDisc: { width: 28, height: 28, borderRadius: Radius.full },
  swatchLabel: { fontSize: 12, lineHeight: 16 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customSwatch: { width: 32, height: 32, borderRadius: Radius.full, borderWidth: 2 },
  customInput: { flex: 1, height: 36, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 10, fontFamily: Fonts.mono, fontSize: 13 },
  save: { alignSelf: 'flex-start' },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.lg, padding: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 44, borderWidth: 1, borderRadius: Radius.lg },
  fields: { borderWidth: 1, borderRadius: Radius.lg },
  field: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  key: { width: 72 },
  hint: { fontSize: 12, lineHeight: 16 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  footText: { fontSize: 11 },
});
