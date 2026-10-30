import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { relativeTime } from '@/lib/display';
import { useOnline } from '@/lib/network';
import { useNow } from '@/lib/now';
import { push, remove, retry } from '@/lib/outbox';
import { toast } from '@/lib/toast';
import { useOutbox } from '@/lib/use-outbox';

/** What is waiting to be committed: push it now, try a refused one again, or drop it. */
export default function OutboxScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = useNow();
  const online = useOnline();
  const items = useOutbox();
  const [pushing, setPushing] = useState(false);

  const pushNow = async () => {
    setPushing(true);

    try {
      const committed = await push(queryClient);
      toast(committed > 0 ? `Pushed ${committed} ${committed === 1 ? 'commit' : 'commits'}.` : online ? 'Nothing could be pushed yet.' : 'Still offline.');
    } finally {
      setPushing(false);
    }
  };

  const drop = (id: string) =>
    Alert.alert('Drop this commit?', 'It was never posted; dropping it forgets the words and the images.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Drop', style: 'destructive', onPress: () => remove(id) },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell }]}>
      <Header
        title={
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Text variant="name" style={styles.title}>Outbox</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={[styles.content, items.length === 0 && { paddingBottom: insets.bottom + Space.gutter }]}>
        <Text variant="small" muted>Commits written without a connection wait here and go out, oldest first, as soon as dev-null.sh can be reached. One devnull refuses stays here with its reason.</Text>

        {items.length === 0 ? (
          <EmptyState fatal="$ git log --branches=outbox">Nothing waiting. Everything you wrote is on /dev/null.</EmptyState>
        ) : (
          items.map((item) => (
            <View key={item.id} style={[styles.item, { backgroundColor: theme.surface, borderColor: item.error ? theme.destructive : theme.hairline }]}>
              <Text variant="mono" muted style={styles.tiny}>
                {item.parentId ? 'reply' : item.quotedCommitId ? 'quote' : 'commit'} · written {relativeTime(item.createdAt, now) === 'now' ? 'just now' : `${relativeTime(item.createdAt, now)} ago`}
                {item.images.length > 0 ? ` · ${item.images.length} ${item.images.length === 1 ? 'image' : 'images'}` : ''}
                {item.poll ? ' · poll' : ''}
              </Text>
              <Text numberOfLines={6}>{item.body || (item.images.length > 0 ? '(images only)' : '')}</Text>
              {item.error && <Text variant="mono" color={theme.destructive} style={styles.tiny}>{item.error}</Text>}
              <View style={styles.actions}>
                {item.error && <Button title="Try again" variant="outline" size="sm" onPress={() => retry(item.id)} />}
                <Button title="Drop" variant="outline" size="sm" onPress={() => drop(item.id)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {items.length > 0 && (
        <View style={[styles.footer, { borderTopColor: theme.hairline, backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, Space.gutter) }]}>
          <Button title={online ? 'Push now' : 'Offline'} disabled={!online} busy={pushing} onPress={pushNow} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16 },
  content: { padding: Space.gutter, gap: 12 },
  item: { borderWidth: 1, borderRadius: Radius.lg, padding: 12, gap: 8 },
  tiny: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  footer: { padding: Space.gutter, borderTopWidth: StyleSheet.hairlineWidth },
});
