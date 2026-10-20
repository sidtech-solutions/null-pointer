import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import { useToast } from '@/lib/toast';

export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  if (!toast) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <View style={[styles.toast, { backgroundColor: theme.ink }]}>
        <Text variant="mono" color={theme.surface} numberOfLines={2}>{toast.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, maxWidth: '100%' },
});
