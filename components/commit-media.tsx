import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import type { CommitImage, LinkPreview } from '@/lib/types';
import { openLink } from '@/lib/links';

export function CommitMedia({ images, preview, compact = false }: { images?: CommitImage[]; preview?: LinkPreview | null; compact?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const { width: screen } = useWindowDimensions();
  const view = (image: CommitImage) => router.push({ pathname: '/image', params: { url: image.url, alt: image.description ?? '' } });
  const width = screen - Space.rail - Space.gutter;
  const shown = (images ?? []).filter((image) => typeof image.url === 'string' && image.url !== '').slice(0, 4);

  if (shown.length === 0 && !preview?.url) {
    return null;
  }

  return (
    <View style={styles.media}>
      {shown.length === 1 && (
        <Pressable onPress={() => view(shown[0])} accessibilityRole="imagebutton" accessibilityLabel={shown[0].description ?? 'Image'}>
          <Image
            source={{ uri: shown[0].url }}
            style={{ width, height: Math.min(320, shown[0].width && shown[0].height ? (width * shown[0].height) / shown[0].width : 200), borderRadius: Radius.lg, backgroundColor: theme.wash }}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={shown[0].url}
            transition={0}
            autoplay
          />
        </Pressable>
      )}

      {shown.length > 1 && (
        <View style={styles.grid}>
          {shown.map((image) => (
            <Pressable key={image.id ?? image.url} onPress={() => view(image)} accessibilityRole="imagebutton" accessibilityLabel={image.description ?? 'Image'}>
              <Image
                source={{ uri: image.url }}
                style={{ width: (width - 4) / 2, height: compact ? 120 : 160, borderRadius: Radius.lg, backgroundColor: theme.wash }}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={image.url}
                transition={0}
                autoplay
              />
            </Pressable>
          ))}
        </View>
      )}

      {preview?.url && (
        <Pressable onPress={() => openLink(preview.url)} style={[styles.card, { borderColor: theme.hairline }]} accessibilityRole="link" accessibilityLabel={preview.title ?? preview.url}>
          {preview.image_url && !compact && (
            <Image source={{ uri: preview.image_url }} style={{ width: '100%', height: Math.round((width - 2) * 0.5), backgroundColor: theme.wash }} contentFit="cover" cachePolicy="disk" recyclingKey={preview.image_url} transition={0} />
          )}
          <View style={styles.cardBody}>
            <Text variant="mono" muted numberOfLines={1} style={styles.site}>
              {preview.site_name || hostOf(preview.url)}
            </Text>
            {preview.title ? (
              <Text variant="name" numberOfLines={2} style={styles.title}>{preview.title}</Text>
            ) : null}
            {preview.description && !compact ? (
              <Text variant="small" muted numberOfLines={2}>{preview.description}</Text>
            ) : null}
          </View>
        </Pressable>
      )}
    </View>
  );
}

function hostOf(url: string): string {
  const match = url.match(/^https?:\/\/([^/]+)/i);

  return (match?.[1] ?? url).replace(/^www\./, '');
}

const styles = StyleSheet.create({
  media: { gap: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  card: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  cardBody: { padding: 10, gap: 2 },
  site: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 14 },
});
