import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { CommitBody } from '@/components/commit-body';
import { Text } from '@/components/text';
import { laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { api } from '@/lib/client';
import type { Attachment } from '@/lib/images';
import { openLink } from '@/lib/links';
import { type Commit, type NewPoll, PollDurations, type User } from '@/lib/types';

/**
 * The draft as the commit it would become, in place of the field, as the web's
 * composer preview shows it: the body at once, with its code and mentions as
 * devnull would keep them once it answers, then the photos and the poll. The
 * server keeps nothing from a preview.
 */
export function DraftPreview({ body, author, images = [], poll = null, quoted = null, onOpenMention }: { body: string; author: User | null | undefined; images?: Attachment[]; poll?: NewPoll | null; quoted?: Commit | null; onOpenMention?: (username: string) => void }) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const trimmed = body.trim();
  const preview = useQuery({
    queryKey: ['commit-preview', trimmed],
    queryFn: () => api.previewCommit(trimmed),
    enabled: trimmed !== '',
    staleTime: 60_000,
    retry: false,
  });
  const width = screen - Space.gutterWide * 2;
  const lane = author ? laneColor(theme, author.lane) : theme.primary;

  if (trimmed === '' && images.length === 0 && !poll) {
    return (
      <View style={styles.empty} accessibilityLabel="Preview">
        <Text variant="small" muted>Nothing to preview yet.</Text>
      </View>
    );
  }

  const shown = preview.data;
  const duration = poll ? PollDurations.find((option) => option.minutes === poll.duration)?.label : null;

  return (
    <View style={styles.preview} accessibilityLabel="Preview">
      {author && (
        <View style={styles.header}>
          <Avatar user={author} size={32} lane={lane} />
          <View style={styles.identity}>
            <Text variant="name" numberOfLines={1} style={styles.name}>{author.name || author.username}</Text>
            <Text variant="mono" muted numberOfLines={1} style={styles.tiny}>@{author.username} · now</Text>
          </View>
        </View>
      )}

      {trimmed !== '' && <CommitBody body={shown?.body ?? trimmed} segments={shown?.body_segments} size={17} onOpenMention={onOpenMention} onOpenLink={openLink} />}

      {preview.isError && <Text variant="mono" muted style={styles.tiny}>Shown as typed; devnull could not render the draft.</Text>}

      {images.length > 0 && (
        <View style={styles.images}>
          {images.map((image) => {
            const side = images.length === 1 ? width : (width - 4 * (images.length - 1)) / images.length;
            const height = images.length === 1 ? Math.min(320, image.height > 0 ? (width * image.height) / image.width : 200) : side;

            return <Image key={image.id} source={{ uri: image.uri }} style={{ width: side, height, borderRadius: Radius.lg, backgroundColor: theme.wash }} contentFit="cover" accessibilityLabel={image.description || 'Image'} />;
          })}
        </View>
      )}

      {poll && (
        <View style={styles.poll} accessibilityLabel="Poll options">
          {poll.options
            .filter((option) => option.trim() !== '')
            .map((option, index) => (
              <View key={index} style={[styles.option, { borderColor: theme.hairline }]}>
                <Text numberOfLines={1}>{option.trim()}</Text>
              </View>
            ))}
          <Text variant="mono" muted style={styles.tiny}>{duration ? `Runs for ${duration} once published.` : ''}</Text>
        </View>
      )}

      {quoted && (
        <View style={[styles.quoted, { borderColor: theme.hairline }]}>
          <View style={styles.quotedHeader}>
            <Text variant="name" numberOfLines={1} style={styles.quotedName}>{quoted.author?.name || quoted.author?.username}</Text>
            <Text variant="mono" muted style={styles.tiny}>@{quoted.author?.username}</Text>
          </View>
          <CommitBody body={quoted.body} segments={quoted.body_segments} size={14} numberOfLines={6} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { minHeight: 120, justifyContent: 'center' },
  preview: { minHeight: 120, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  identity: { flex: 1, gap: 1 },
  name: { fontSize: 15 },
  tiny: { fontSize: 12, lineHeight: 16 },
  images: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  poll: { gap: 8 },
  option: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  quoted: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotedName: { flexShrink: 1, fontSize: 14 },
});
