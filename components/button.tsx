import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

const heights: Record<Size, number> = { sm: 32, md: 36, lg: 44 };

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  busy = false,
  disabled,
  accent,
  style,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  /** A fill other than `primary` (the person's lane) that still darkens under the thumb. */
  accent?: string;
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const fill = (pressed: boolean): string => {
    switch (variant) {
      case 'primary':
        return accent ? (pressed ? `${accent}cc` : accent) : pressed ? theme.primaryHover : theme.primary;
      case 'destructive':
        return theme.destructive;
      case 'outline':
        return pressed ? theme.wash : theme.shell;
      case 'ghost':
        return pressed ? theme.wash : 'transparent';
    }
  };

  const label = variant === 'primary' || variant === 'destructive' ? theme.primaryInk : theme.ink;

  return (
    <Pressable
      {...props}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { height: heights[size], backgroundColor: fill(pressed), opacity: disabled ? 0.5 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: theme.rail },
        style,
      ]}>
      {busy ? <ActivityIndicator color={label} /> : <Text variant="label" color={label}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
});
