import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { Fonts, useTheme } from '@/constants/theme';

// Same drawing as the app icon and splash image; the loading screen relies on
// them matching.
export function NullPointerMark({ width = 120 }: { width?: number }) {
  const theme = useTheme();
  const height = Math.round(width * 0.42);

  return (
    <Svg width={width} height={height} viewBox="0 0 1000 420">
      <Path d="M48 210 H560" stroke={theme.ink} strokeWidth={96} strokeLinecap="round" fill="none" />
      <Path d="M430 80 L562 210 L430 340" stroke={theme.ink} strokeWidth={96} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={800} cy={210} r={160} stroke={theme.lanes[0]} strokeWidth={96} fill="none" />
    </Svg>
  );
}

export function NullPointerWordmark({ size = 28 }: { size?: number }) {
  const theme = useTheme();

  return (
    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: size, lineHeight: size * 1.1, letterSpacing: -size * 0.04 }}>
      null<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: size, color: theme.lanes[0] }}>-</Text>pointer
    </Text>
  );
}

export function NullPointerLogo({ width = 140 }: { width?: number }) {
  return (
    <View style={styles.stack}>
      <NullPointerMark width={width} />
      <NullPointerWordmark size={Math.round(width * 0.22)} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center', gap: 20 },
});
