import { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';

const Height = 28;
const Thumb = 24;

/**
 * One slider of a colour mixer: a gradient track showing what each position
 * would give, and a thumb that follows the finger. Reports every step, so the
 * swatch follows the drag, as the NativePHP app's colour sheet does.
 */
export function HslSlider({ label, value, stops, onChange }: { label: string; value: number; stops: string[]; onChange: (value: number) => void }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const latest = useRef(onChange);

  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  // The responder is built once; it reads the width and the callback through refs.
  /* eslint-disable react-hooks/refs */
  const responder = useMemo(() => {
    const move = (x: number) => {
      if (widthRef.current > 0) {
        latest.current(Math.min(1, Math.max(0, x / widthRef.current)));
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => move(event.nativeEvent.locationX),
      onPanResponderMove: (event) => move(event.nativeEvent.locationX),
      onPanResponderTerminationRequest: () => false,
    });
  }, []);
  /* eslint-enable react-hooks/refs */

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };

  const id = `track-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const left = Math.max(0, Math.min(width - Thumb, value * width - Thumb / 2));

  return (
    <View style={styles.slider}>
      <Text variant="mono" muted style={styles.label}>{label}</Text>
      <View onLayout={onLayout} style={styles.track} {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
        {width > 0 && (
          <Svg width={width} height={Height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                {stops.map((color, index) => (
                  <Stop key={index} offset={stops.length === 1 ? 0 : index / (stops.length - 1)} stopColor={color} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={Height} rx={Height / 2} fill={`url(#${id})`} />
          </Svg>
        )}
        <View pointerEvents="none" style={[styles.thumb, { left, borderColor: theme.surface, backgroundColor: stops[Math.round(value * (stops.length - 1))] ?? theme.ink }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slider: { gap: 4 },
  label: { fontSize: 12, lineHeight: 16 },
  track: { height: Height, borderRadius: Radius.full, justifyContent: 'center', overflow: 'visible' },
  thumb: { position: 'absolute', width: Thumb, height: Thumb, borderRadius: Thumb / 2, borderWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
});
