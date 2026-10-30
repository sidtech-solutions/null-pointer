import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { ZoomableImage } from '@/components/zoomable-image';
import { Radius } from '@/constants/theme';
import type { ViewerImage } from '@/lib/viewer';

// A lightbox is black in both themes, as the photo apps are; these are its chrome, not theme tokens.
const Viewer = { back: '#000000', ink: '#ffffff', inkMuted: '#ececec', chrome: 'rgba(0, 0, 0, 0.5)', caption: 'rgba(0, 0, 0, 0.6)' } as const;

/**
 * A commit's images full screen: swipe or use the arrows to move between
 * them, pinch or double tap to zoom the one showing, tap it or the cross to
 * close, or drag it down and let go. Android's back closes it too, as any screen.
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
  // The pager stops swiping while an image is enlarged, so a drag moves the image, not the gallery.
  const [zoomed, setZoomed] = useState(false);
  const current = images[index] ?? images[0];
  // Per image: loading until it paints, failed when it never will.
  const [state, setState] = useState<Record<string, 'loaded' | 'failed'>>({});
  const [leaving, setLeaving] = useState(false);

  const close = () => {
    if (!leaving) {
      setLeaving(true);
      router.back();
    }
  };

  const go = (to: number) => {
    const next = Math.min(images.length - 1, Math.max(0, to));
    pager.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const settled = (event: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width));

  return (
    <View style={styles.screen}>
      <ScrollView ref={pager} horizontal pagingEnabled scrollEnabled={!zoomed} contentOffset={{ x: start * width, y: 0 }} onMomentumScrollEnd={settled} showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {images.map((image, position) => (
          <View key={`${position}-${image.url}`} style={{ width, height }}>
            <ZoomableImage
              width={width}
              height={height}
              source={{ uri: image.url }}
              cachePolicy="disk"
              autoplay
              transition={160}
              accessibilityLabel={image.alt || 'Image'}
              onLoad={() => setState((s) => ({ ...s, [image.url]: 'loaded' }))}
              onError={() => setState((s) => ({ ...s, [image.url]: 'failed' }))}
              onTap={close}
              onDismiss={close}
              onZoomed={setZoomed}
              backdrop={Viewer.back}
            />
            {state[image.url] === undefined && (
              <View style={styles.status} pointerEvents="none">
                <ActivityIndicator color={Viewer.inkMuted} />
              </View>
            )}
            {state[image.url] === 'failed' && (
              <View style={styles.status} pointerEvents="none">
                <Text variant="mono" color={Viewer.inkMuted}>fatal: could not load the image</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Pressable onPress={close} style={({ pressed }) => [styles.round, styles.close, { top: insets.top + 8, opacity: pressed ? 0.7 : 1 }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <X size={22} color={Viewer.ink} strokeWidth={2} />
      </Pressable>

      {images.length > 1 && !zoomed && (
        <>
          <View style={[styles.counter, { top: insets.top + 14 }]} accessibilityLiveRegion="polite">
            <Text variant="mono" color={Viewer.inkMuted} style={styles.counterText}>{index + 1} / {images.length}</Text>
          </View>
          {index > 0 && (
            <Pressable onPress={() => go(index - 1)} style={[styles.round, styles.arrow, styles.previous]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous image">
              <ChevronLeft size={22} color={Viewer.ink} strokeWidth={2} />
            </Pressable>
          )}
          {index < images.length - 1 && (
            <Pressable onPress={() => go(index + 1)} style={[styles.round, styles.arrow, styles.next]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next image">
              <ChevronRight size={22} color={Viewer.ink} strokeWidth={2} />
            </Pressable>
          )}
        </>
      )}

      {current?.alt && !zoomed ? (
        <View style={[styles.caption, { paddingBottom: insets.bottom + 16 }]}>
          <Text variant="small" color={Viewer.inkMuted} style={styles.captionText}>{current.alt}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The page paints its own black; the screen stays clear so a drag down shows what was underneath.
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  status: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  round: { position: 'absolute', width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Viewer.chrome, alignItems: 'center', justifyContent: 'center' },
  close: { right: 16 },
  counter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  counterText: { fontSize: 13, backgroundColor: Viewer.chrome, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, overflow: 'hidden' },
  arrow: { top: '50%', marginTop: -20 },
  previous: { left: 12 },
  next: { right: 12 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: Viewer.caption },
  captionText: { textAlign: 'center' },
});
