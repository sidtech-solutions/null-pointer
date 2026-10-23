import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import type { ViewerImage } from '@/lib/viewer';

/**
 * A commit's images full screen: swipe or use the arrows to move between
 * them, pinch to zoom the one showing, tap it or the cross to close. Android's
 * back closes it too, as any screen.
 */
export default function ImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ url: string; alt?: string; gallery?: string; index?: string }>();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);

  const images = useMemo<ViewerImage[]>(() => {
    try {
      const parsed = params.gallery ? (JSON.parse(params.gallery) as ViewerImage[]) : [];
      const list = parsed.filter((image) => typeof image?.url === 'string' && image.url !== '');

      return list.length > 0 ? list : [{ url: params.url, alt: params.alt ?? '' }];
    } catch {
      return [{ url: params.url, alt: params.alt ?? '' }];
    }
  }, [params.gallery, params.url, params.alt]);

  const start = Math.min(images.length - 1, Math.max(0, Number(params.index ?? 0) || 0));
  const [index, setIndex] = useState(start);
  const current = images[index] ?? images[0];

  const go = (to: number) => {
    const next = Math.min(images.length - 1, Math.max(0, to));
    pager.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const settled = (event: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width));

  return (
    <View style={styles.screen}>
      <ScrollView ref={pager} horizontal pagingEnabled contentOffset={{ x: start * width, y: 0 }} onMomentumScrollEnd={settled} showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {images.map((image, position) => (
          <ScrollView
            key={`${position}-${image.url}`}
            contentContainerStyle={{ width, height }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}>
            <Pressable onPress={() => router.back()} style={{ width, height }}>
              <Image source={{ uri: image.url }} style={{ width, height }} contentFit="contain" cachePolicy="disk" autoplay accessibilityLabel={image.alt || 'Image'} />
            </Pressable>
          </ScrollView>
        ))}
      </ScrollView>

      <Pressable onPress={() => router.back()} style={[styles.round, styles.close, { top: insets.top + 8 }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <X size={22} color="#ffffff" strokeWidth={2} />
      </Pressable>

      {images.length > 1 && (
        <>
          <View style={[styles.counter, { top: insets.top + 14 }]} accessibilityLiveRegion="polite">
            <Text variant="mono" color="#ececec" style={styles.counterText}>{index + 1} / {images.length}</Text>
          </View>
          {index > 0 && (
            <Pressable onPress={() => go(index - 1)} style={[styles.round, styles.arrow, styles.previous]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous image">
              <ChevronLeft size={22} color="#ffffff" strokeWidth={2} />
            </Pressable>
          )}
          {index < images.length - 1 && (
            <Pressable onPress={() => go(index + 1)} style={[styles.round, styles.arrow, styles.next]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next image">
              <ChevronRight size={22} color="#ffffff" strokeWidth={2} />
            </Pressable>
          )}
        </>
      )}

      {current?.alt ? (
        <View style={[styles.caption, { paddingBottom: insets.bottom + 16 }]}>
          <Text variant="small" color="#ececec" style={styles.captionText}>{current.alt}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  round: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  close: { right: 16 },
  counter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  counterText: { fontSize: 13, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  arrow: { top: '50%', marginTop: -18 },
  previous: { left: 12 },
  next: { right: 12 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  captionText: { textAlign: 'center' },
});
