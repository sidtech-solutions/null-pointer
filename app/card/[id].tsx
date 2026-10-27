import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Button } from '@/components/button';
import { CommitCard } from '@/components/commit-card';
import { EmptyState } from '@/components/empty-state';
import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import { api, baseUrl } from '@/lib/client';
import { findCachedCommit } from '@/lib/commit-cache';
import { shortHash } from '@/lib/display';
import { toast } from '@/lib/toast';

// The card is drawn at this width and captured at three times it, so it is 1200px wide wherever it is posted.
const CardWidth = 400;
const CaptureScale = 3;

/**
 * A commit as an image to share: a preview of the card, then the system share
 * sheet with the PNG. The link goes along as text where the sheet takes both.
 */
export default function CardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width: screen } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  const thread = useQuery({
    queryKey: ['commit', id],
    queryFn: () => api.commit(id),
    placeholderData: () => {
      const cached = findCachedCommit(queryClient, id);

      return cached ? { commit: cached, ancestors: [], series: [] } : undefined;
    },
  });

  const commit = thread.data?.commit;
  const scale = Math.min(1, (screen - Space.gutter * 2) / CardWidth);
  const url = commit ? (commit.html_url ?? `${baseUrl()}/@${commit.author.handle}/commits/${commit.id}`) : '';

  const share = async () => {
    if (!commit || !card.current) {
      return;
    }

    setSharing(true);

    try {
      const file = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', width: CardWidth * CaptureScale });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file, { mimeType: 'image/png', dialogTitle: `Commit ${commit.short_hash || shortHash(commit.id)}`, UTI: 'public.png' });
      } else {
        await Share.share(Platform.OS === 'ios' ? { url: file, message: url } : { message: url });
      }
    } catch {
      toast('fatal: could not make the image.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell, paddingTop: Platform.OS === 'ios' ? 12 : insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <X size={22} color={theme.ink} strokeWidth={2} />
        </Pressable>
        <Text variant="name" style={styles.title}>Share as image</Text>
        <View style={styles.close} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!commit && thread.isPending && <ActivityIndicator color={theme.inkMuted} style={styles.loading} />}
        {!commit && thread.isError && <EmptyState fatal={thread.error.message} action="Try again" onAction={() => thread.refetch()} />}

        {commit && (
          // The card keeps its design width and is scaled to fit the screen; the capture reads the unscaled view.
          <View style={{ width: CardWidth * scale, height: undefined, alignItems: 'flex-start' }}>
            <View ref={card} collapsable={false} style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
              <CommitCard commit={commit} width={CardWidth} />
            </View>
          </View>
        )}

        {commit && <Text variant="small" muted style={styles.hint}>A 1200px PNG with the commit, its code and your lane. The link is {url.replace(/^https?:\/\//, '')}.</Text>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title="Share image" busy={sharing} disabled={!commit} onPress={share} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16 },
  content: { padding: Space.gutter, gap: 16, alignItems: 'center' },
  loading: { paddingVertical: 48 },
  hint: { textAlign: 'center', paddingHorizontal: Space.gutter },
  footer: { paddingHorizontal: Space.gutter, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
