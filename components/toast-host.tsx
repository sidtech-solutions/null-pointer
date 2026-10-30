import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import { dismissToast, useToast } from '@/lib/toast';

const Settle = Easing.bezier(0.23, 1, 0.32, 1);

export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  // Over the keyboard when one is up, else over the tab bar / reply bar, as the keyboard moves.
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({ bottom: Math.max(insets.bottom + 72, keyboard.height.get() + 12) }));
  // A toast with a button counts down beside it, so the person sees how long the offer lasts.
  const [left, setLeft] = useState(0);
  const until = toast?.until ?? 0;
  const counting = toast !== null && toast.action !== null && toast.until - toast.id > 5_000;

  useEffect(() => {
    if (!counting) {
      return;
    }

    const update = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 500);

    return () => clearInterval(interval);
  }, [counting, until]);

  if (!toast) {
    return null;
  }

  const action = toast.action;

  // Keyed by id so a toast replacing another plays its own entrance; the exit is quicker than the entrance.
  return (
    <Animated.View key={toast.id} entering={FadeInDown.duration(220).easing(Settle)} exiting={FadeOutDown.duration(140)} style={[styles.wrap, { pointerEvents: action ? 'box-none' : 'none' }, lift]}>
      <Animated.View style={[styles.toast, { backgroundColor: theme.ink }, action && styles.withAction]} accessibilityLiveRegion="polite">
        <Text variant="mono" color={theme.surface} numberOfLines={2} style={action ? styles.grow : undefined}>
          {toast.text}
          {counting ? <Text variant="mono" color={theme.rail}> · {left}s</Text> : null}
        </Text>
        {action && (
          <Pressable
            onPress={() => {
              dismissToast();
              action.run();
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.surface }, pressed && styles.pressed]}
            accessibilityRole="button">
            <Text variant="label" color={theme.ink}>{action.label}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderCurve: 'continuous', maxWidth: '100%' },
  withAction: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', paddingVertical: 8 },
  grow: { flex: 1 },
  button: { height: 30, paddingHorizontal: 12, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
