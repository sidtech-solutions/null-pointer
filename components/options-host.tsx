import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { closeOptions, useOptions } from '@/lib/options';

/** The Android bottom sheet behind `showOptions`; mounted once, over everything. */
export function OptionsHost() {
  const theme = useTheme();
  const request = useOptions();

  return (
    <Sheet visible={request !== null} onClose={closeOptions}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: Space.gutter + 4, paddingVertical: 10, gap: 2 },
  list: { flexGrow: 0 },
  row: { paddingHorizontal: Space.gutter + 4, paddingVertical: 14, borderRadius: Radius.md },
});
