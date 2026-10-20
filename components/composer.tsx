import { FoldVertical } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Text } from '@/components/text';
import { Fonts, useTheme } from '@/constants/theme';
import { CountFrom, length, MaxLength } from '@/lib/display';

export function BodyCounter({ body }: { body: string }) {
  const theme = useTheme();
  const remaining = MaxLength - length(body);

  if (remaining <= CountFrom) {
    return (
      <Text variant="mono" color={remaining <= 0 ? theme.destructive : remaining <= 20 ? '#b45309' : theme.inkMuted} accessibilityLabel={`${remaining} characters left`}>
        {remaining}
      </Text>
    );
  }

  if (length(body) > 280 || body.split('\n').length > 8) {
    return <FoldVertical size={16} color={theme.inkMuted} strokeWidth={2} />;
  }

  return null;
}

export function ComposerInput({ style, ...props }: TextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      {...props}
      multiline
      maxLength={MaxLength}
      placeholderTextColor={theme.inkMuted}
      selectionColor={theme.primary}
      style={[styles.input, { color: theme.ink }, style]}
    />
  );
}

export function StashLabel({ onDrop }: { onDrop: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.stash} accessibilityLabel="Restored your unsent draft">
      <Text variant="mono" muted>stash@{'{0}'}</Text>
      <Pressable onPress={onDrop} hitSlop={8}>
        <Text variant="mono" color={theme.inkMuted} style={styles.drop}>drop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: Fonts.sans, fontSize: 17, lineHeight: 23, textAlignVertical: 'top', padding: 0 },
  stash: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drop: { textDecorationLine: 'underline' },
});
