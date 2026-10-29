import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { closeOptions, useOptions } from '@/lib/options';

/** The Android bottom sheet behind `showOptions`; mounted once, over everything. */
export function OptionsHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const request = useOptions();

  return (
    <Modal visible={request !== null} transparent animationType="fade" onRequestClose={closeOptions} statusBarTranslucent>
      <Pressable onPress={closeOptions} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {request && (
            <>
              <View style={styles.head}>
                <Text variant="name" numberOfLines={2}>{request.title}</Text>
                {request.message ? <Text variant="small" muted>{request.message}</Text> : null}
              </View>
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {request.options.map((option) => (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      closeOptions();
                      option.run();
                    }}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.wash }]}
                    accessibilityRole="button">
                    <Text color={option.destructive ? theme.destructive : theme.ink}>{option.label}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={closeOptions} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.wash }]} accessibilityRole="button">
                  <Text muted>Cancel</Text>
                </Pressable>
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  head: { paddingHorizontal: Space.gutter + 4, paddingVertical: 10, gap: 2 },
  list: { flexGrow: 0 },
  row: { paddingHorizontal: Space.gutter + 4, paddingVertical: 14, borderRadius: Radius.md },
});
