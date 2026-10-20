import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';

export default function ImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { url, alt } = useLocalSearchParams<{ url: string; alt?: string }>();

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ width, height }}
        maximumZoomScale={4}
        minimumZoomScale={1}
        bouncesZoom
        centerContent
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={{ width, height }}>
          <Image source={{ uri: url }} style={{ width, height }} contentFit="contain" cachePolicy="disk" autoplay accessibilityLabel={alt || 'Image'} />
        </Pressable>
      </ScrollView>

      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + 8 }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <X size={22} color="#ffffff" strokeWidth={2} />
      </Pressable>

      {alt ? (
        <View style={[styles.caption, { paddingBottom: insets.bottom + 16 }]}>
          <Text variant="small" color="#ececec" style={styles.captionText}>{alt}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  close: { position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  captionText: { textAlign: 'center' },
});
