import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';

export type HeaderTab<K extends string> = { key: K; label: string };

export function Header<K extends string>({
  title,
  right,
  tabs,
  active,
  onChange,
  accent,
}: {
  title?: ReactNode;
  right?: ReactNode;
  tabs?: HeaderTab<K>[];
  active?: K;
  onChange?: (key: K) => void;
  accent?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const underline = accent ?? theme.primary;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }}>
      {title !== undefined && (
        <View style={styles.bar}>
          {typeof title === 'string' ? <Text variant="name" style={styles.title}>{title}</Text> : title}
          <View style={styles.spacer} />
          {right}
        </View>
      )}

      {tabs && (
        <View style={styles.tabs}>
          {tabs.map((tab) => {
            const isActive = tab.key === active;

            return (
              <Pressable key={tab.key} onPress={() => onChange?.(tab.key)} accessibilityRole="tab" accessibilityState={{ selected: isActive }} style={styles.tab}>
                <View style={styles.tabLabel}>
                  <Text variant="nav" muted={!isActive}>{tab.label}</Text>
                  <View style={[styles.underline, { backgroundColor: isActive ? underline : 'transparent' }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: Space.header, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.gutter },
  title: { fontSize: 16 },
  spacer: { flex: 1 },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14 },
  tabLabel: { alignItems: 'center', gap: 10 },
  underline: { height: 3, alignSelf: 'stretch', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
