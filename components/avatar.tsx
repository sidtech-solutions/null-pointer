import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import type { User } from '@/lib/types';

export function Avatar({ user, size = 40, lane, dashed = false }: { user: Pick<User, 'name' | 'username' | 'avatar_url'>; size?: number; lane?: string; dashed?: boolean }) {
  const theme = useTheme();
  const initial = (user.name || user.username || '?').trim().charAt(0).toUpperCase();

  const image = user.avatar_url ? (
    <Image source={{ uri: user.avatar_url }} style={{ width: size, height: size, borderRadius: Radius.full, backgroundColor: theme.wash }} cachePolicy="disk" transition={0} recyclingKey={user.avatar_url} />
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
