import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, KeyRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { SettingsHeading } from '@/components/settings-heading';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import { existingKey, forgetKey } from '@/lib/device-key';
import { relativeTime } from '@/lib/display';
import { useNow } from '@/lib/now';
import type { Device } from '@/lib/types';

/** Every key approved to sign as the user, as the web's Devices page lists them, and a way to revoke one. */
export default function DevicesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const account = useAccount();
  const queryClient = useQueryClient();
  const now = useNow();
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    existingKey().then((key) => setFingerprint(key?.fingerprint() ?? null));
  }, []);

  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api.devices(), enabled: account.status === 'signed-in' });

  const revoke = useMutation({
    mutationFn: (device: Device) => api.revokeDevice(device.id),
    onSuccess: async (_result, device) => {
      if (device.fingerprint === fingerprint) {
        // The server no longer takes this phone's key; the app follows.
        await forgetKey();
        await account.signOut();

        return;
      }

      queryClient.setQueryData<Device[]>(['devices'], (list) => list?.filter((candidate) => candidate.id !== device.id));
    },
    onError: (error) => Alert.alert(error instanceof ApiError ? error.firstError() : 'fatal: could not revoke the device.'),
  });

  const confirm = (device: Device) => {
    const mine = device.fingerprint === fingerprint;

    Alert.alert(mine ? 'Sign this phone out?' : `Revoke ${device.name}?`, mine ? 'Revokes this phone’s key on dev-null.sh and signs you out here. Signing in again makes a new key.' : 'That device can no longer sign in as you. Its app will ask to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: mine ? 'Sign out' : 'Revoke', style: 'destructive', onPress: () => revoke.mutate(device) },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Devices</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Space.gutterWide }]} refreshControl={<RefreshControl refreshing={devices.isFetching && !devices.isPending} onRefresh={() => {
              devices.refetch();
            }} tintColor={theme.inkMuted} />}>
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
          <SettingsHeading title="Approved keys" description="Each phone, computer and CLI you signed in from has its own SSH key. Revoke one you no longer use or recognise." />

          {devices.isPending && (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.inkMuted} />
            </View>
          )}

          {devices.isError && <EmptyState fatal={devices.error.message} action="Try again" onAction={() => devices.refetch()} />}

          {devices.data?.map((device, index) => {
            const mine = device.fingerprint === fingerprint;
            const busy = revoke.isPending && revoke.variables?.id === device.id;

            return (
              <View key={device.id} style={[styles.device, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline }]}>
                <View style={[styles.icon, { backgroundColor: mine ? theme.primarySoft : theme.wash }]}>
                  <KeyRound size={18} color={mine ? theme.primary : theme.inkMuted} strokeWidth={2} />
                </View>
                <View style={styles.names}>
                  <Text variant="name" numberOfLines={2}>{device.name}</Text>
                  <Text variant="mono" muted numberOfLines={1} style={styles.tiny}>{device.fingerprint}</Text>
                  <View style={styles.nameRow}>
                    {mine && (
                      <View style={[styles.chip, { backgroundColor: theme.primarySoft }]}>
                        <Text variant="mono" color={theme.primary} style={styles.tiny}>this phone</Text>
                      </View>
                    )}
                    <Text variant="small" muted numberOfLines={1} style={[styles.tiny, styles.shrink]}>
                      Approved {relativeTime(device.approved_at, now)} ago{device.last_used_at ? ` · used ${relativeTime(device.last_used_at, now) === 'now' ? 'just now' : `${relativeTime(device.last_used_at, now)} ago`}` : ' · never used'}
                    </Text>
                  </View>
                </View>
                <Button title={mine ? 'Sign out' : 'Revoke'} size="sm" variant="outline" busy={busy} disabled={revoke.isPending} onPress={() => confirm(device)} />
              </View>
            );
          })}

          {devices.data && devices.data.length === 0 && <Text variant="small" muted>No approved keys. That should not happen while you are signed in; pull to try again.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  content: { padding: Space.gutter, gap: 12 },
  section: { padding: Space.gutter, gap: 12, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  loading: { paddingVertical: 24, alignItems: 'center' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  names: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.sm },
  tiny: { fontSize: 12, lineHeight: 16 },
});
