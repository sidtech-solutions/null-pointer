import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { clamp, runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';

const Height = 28;
const Thumb = 24;
// How far the value must move before the screen hears about it mid-drag; the end always reports.
const Step = 0.01;

/**
 * One slider of a colour mixer: a gradient track showing what each position
 * would give, and a thumb that follows the finger on the UI thread. The
 * screen hears about the value in steps while dragging and exactly on
 * release, so the swatch follows without re-rendering every frame.
 */
export function HslSlider({ label, value, stops, onChange }: { label: string; value: number; stops: string[]; onChange: (value: number) => void }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const trackWidth = useSharedValue(0);
  const position = useSharedValue(value);
  const reported = useSharedValue(value);
  const dragging = useSharedValue(false);
  const latest = useRef(onChange);

  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  // A preset picked elsewhere moves the thumb; a drag in progress is not interrupted.
  useEffect(() => {
    if (!dragging.get()) {
      position.set(value);
      reported.set(value);
    }
  }, [value, position, reported, dragging]);

  const report = useCallback((next: number) => latest.current(next), []);

  const pan = usePanGesture({
    minDistance: 0,
    shouldCancelWhenOutside: false,
    hitSlop: { top: 8, bottom: 8 },
    onBegin: (event) => {
      'worklet';
      dragging.set(true);
      const next = clamp(event.x / Math.max(1, trackWidth.get()), 0, 1);
      position.set(next);
      reported.set(next);
      runOnJS(report)(next);
    },
    onUpdate: (event) => {
      'worklet';
      const next = clamp(event.x / Math.max(1, trackWidth.get()), 0, 1);
      position.set(next);

      if (Math.abs(next - reported.get()) >= Step) {
        reported.set(next);
        runOnJS(report)(next);
      }
    },
    onFinalize: () => {
      'worklet';
      dragging.set(false);
      const next = position.get();

      if (next !== reported.get()) {
        reported.set(next);
        runOnJS(report)(next);
      }
    },
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: clamp(position.get() * trackWidth.get() - Thumb / 2, 0, Math.max(0, trackWidth.get() - Thumb)) }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    trackWidth.set(event.nativeEvent.layout.width);
    setWidth(event.nativeEvent.layout.width);
  };

  const id = `track-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <View style={styles.slider}>
      <Text variant="mono" muted style={styles.label}>{label}</Text>
      <GestureDetector gesture={pan}>
        <View
          onLayout={onLayout}
          style={styles.track}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => onChange(Math.max(0, Math.min(1, value + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}>
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
          <Animated.View pointerEvents="none" style={[styles.thumb, { borderColor: theme.surface, backgroundColor: stops[Math.round(value * (stops.length - 1))] ?? theme.ink }, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  slider: { gap: 4 },
  label: { fontSize: 12, lineHeight: 16 },
  track: { height: Height, borderRadius: Radius.full, justifyContent: 'center', overflow: 'visible' },
  thumb: { position: 'absolute', left: 0, width: Thumb, height: Thumb, borderRadius: Thumb / 2, borderWidth: 3, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)' },
});
