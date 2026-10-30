import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, useTheme } from '@/constants/theme';

// A strong ease-out: the sheet arrives fast and settles, and leaves faster than it came.
const Enter = 280;
const Leave = 180;
const Settle = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A bottom sheet over the screen: the scrim fades, the sheet rises. The scrim
 * is a sibling of the sheet, not its parent, so assistive tech reaches the
 * controls inside and still has one "Close" to escape with. The modal stays
 * mounted until the exit has played; Reduce Motion skips both animations.
 */
export function Sheet({ visible, onClose, children, style, maxHeight = '80%' }: { visible: boolean; onClose: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; maxHeight?: ViewStyle['maxHeight'] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [open, setOpen] = useState(visible);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      setOpen(true);

      return;
    }

    setOpen(false);
    const timer = setTimeout(() => setMounted(false), Leave + 20);

    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.fill}>
        {open && (
          <Animated.View entering={FadeIn.duration(Enter - 80)} exiting={FadeOut.duration(Leave)} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}>
            <Pressable onPress={onClose} style={styles.fill} accessibilityRole="button" accessibilityLabel="Close" />
          </Animated.View>
        )}
        {open && (
          <Animated.View
            entering={SlideInDown.duration(Enter).easing(Settle)}
            exiting={SlideOutDown.duration(Leave)}
            onAccessibilityEscape={onClose}
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12), maxHeight }, style]}>
            {children}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, paddingTop: 8, overflow: 'hidden' },
});
