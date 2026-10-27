import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { CommitBody } from '@/components/commit-body';
import { Text } from '@/components/text';
import { Fonts, laneColor, Radius, useTheme } from '@/constants/theme';
import { shortHash } from '@/lib/display';
import type { Commit } from '@/lib/types';

const Months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function longDate(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : `${Months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * A commit as a picture to share: the author in their lane, the body with its
 * code and quotes as the app draws them, the first image, the poll's options,
 * the commit it quotes, and a footer that says where it lives. Drawn at a
 * fixed width so the capture looks the same on every phone.
 */
export function CommitCard({ commit, width }: { commit: Commit; width: number }) {
  const theme = useTheme();
  const lane = laneColor(theme, commit.author?.lane);
  const image = commit.images?.find((candidate) => typeof candidate.url === 'string' && candidate.url !== '');
  const inner = width - 2 * Pad;
  const imageHeight = image?.width && image.height ? Math.min(inner * 0.75, (inner * image.height) / image.width) : inner * 0.56;

  return (
    <View style={[styles.card, { width, backgroundColor: theme.surface, borderColor: theme.hairline }]}>
      <View style={[styles.rail, { backgroundColor: lane }]} />

      <View style={styles.header}>
        <Avatar user={commit.author} size={44} lane={lane} />
        <View style={styles.identity}>
          <Text variant="name" numberOfLines={1} style={styles.name}>{commit.author.name || commit.author.handle}</Text>
          <Text variant="mono" muted numberOfLines={1}>@{commit.author.handle} · {longDate(commit.created_at)}</Text>
        </View>
      </View>

      <CommitBody body={commit.body} segments={commit.body_segments} size={18} />

      {image && <Image source={{ uri: image.url }} style={{ width: inner, height: imageHeight, borderRadius: Radius.lg, backgroundColor: theme.wash }} contentFit="cover" cachePolicy="disk" transition={0} accessibilityLabel={image.description ?? 'Image'} />}

      {commit.poll && (
        <View style={styles.poll}>
          {commit.poll.options.map((option) => (
            <View key={option.id} style={[styles.option, { borderColor: theme.hairline }]}>
              <Text numberOfLines={1} style={styles.optionText}>{option.label}</Text>
              {typeof option.percentage === 'number' && <Text variant="mono" muted>{Math.round(option.percentage)}%</Text>}
            </View>
          ))}
        </View>
      )}

      {commit.quoted_commit && (
        <View style={[styles.quoted, { borderColor: theme.hairline }]}>
          <Text variant="mono" muted numberOfLines={1}>
            {commit.quoted_commit.author?.name || commit.quoted_commit.author?.handle} · @{commit.quoted_commit.author?.handle}
          </Text>
          <CommitBody body={commit.quoted_commit.body} segments={commit.quoted_commit.body_segments} size={15} numberOfLines={6} />
        </View>
      )}

      <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
        <View style={styles.footerLeft}>
          <View style={[styles.dot, { backgroundColor: lane }]} />
          <Text variant="mono" muted numberOfLines={1}>@{commit.author.handle}/{commit.short_hash || shortHash(commit.id)}</Text>
        </View>
        <View style={styles.footerRight}>
          {(commit.stars_count > 0 || commit.replies_count > 0) && (
            <Text variant="mono" muted>
              {commit.stars_count > 0 ? `★ ${commit.stars_count}` : ''}
              {commit.stars_count > 0 && commit.replies_count > 0 ? ' · ' : ''}
              {commit.replies_count > 0 ? `${commit.replies_count} ${commit.replies_count === 1 ? 'reply' : 'replies'}` : ''}
            </Text>
          )}
          <Text style={[styles.wordmark, { color: theme.ink }]}>
            /dev<Text style={[styles.wordmark, { color: theme.lanes[0] }]}>/</Text>null
          </Text>
        </View>
      </View>
    </View>
  );
}

const Pad = 24;

const styles = StyleSheet.create({
  card: { padding: Pad, paddingLeft: Pad + 6, gap: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, overflow: 'hidden' },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: 17 },
  poll: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  optionText: { flexShrink: 1, fontSize: 15 },
  quoted: { borderWidth: 1, borderRadius: Radius.lg, padding: 12, gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 4 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: Radius.full },
  wordmark: { fontFamily: Fonts.sansSemiBold, fontSize: 15, letterSpacing: -0.4 },
});
