import { Image } from 'expo-image';
import { useState } from 'react';
import { PixelRatio, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import { sizedAvatarUrl } from '@/lib/avatar-url';
import type { User } from '@/lib/types';

export function Avatar({ user, size = 40, lane, dashed = false }: { user: Pick<User, 'name' | 'handle' | 'avatar_url'>; size?: number; lane?: string; dashed?: boolean }) {
  const theme = useTheme();
  const initial = (user.name || user.handle || '?').trim().charAt(0).toUpperCase();

  // Fetched at the drawn size, in device pixels, as the web does: a 40pt avatar needs no 460px JPEG.
  const uri = user.avatar_url ? sizedAvatarUrl(user.avatar_url, size * PixelRatio.get()) : null;
  // GitHub's avatar CDN can stall for seconds on a slow network; a load that gives up shows the initial instead of a hole.
  const [failed, setFailed] = useState(false);
  const image = uri && !failed ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: Radius.full, backgroundColor: theme.wash }} cachePolicy="disk" transition={0} recyclingKey={uri} onError={() => setFailed(true)} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: Radius.full, backgroundColor: theme.wash, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="name" muted>{initial}</Text>
    </View>
  );

  if (!lane) {
    return image;
  }

  return (
    <View style={{ padding: 2, borderWidth: 2, borderColor: lane, borderStyle: dashed ? 'dashed' : 'solid', borderRadius: Radius.full, backgroundColor: theme.surface }}>
      {image}
    </View>
  );
}
