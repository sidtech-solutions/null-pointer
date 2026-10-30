import { Image, type ImageProps } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { clamp, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const MaxScale = 4;
const DoubleTapScale = 2.5;
const DismissDistance = 120;
const DismissVelocity = 900;
// A lone tap closes only once a second tap has had its chance to turn it into a zoom.
const SecondTapWithin = 350;
const Spring = { damping: 20, stiffness: 240 } as const;

/**
 * One image of the viewer, the same on both platforms: pinch to zoom, drag
 * the zoomed image around, double tap to zoom in and out, tap to close, and
 * drag an unzoomed image down to close it, the backdrop fading as it goes.
 * Every gesture runs on the UI thread; the screen only hears "zoomed" (to
 * freeze the pager) and "dismiss".
 */
export function ZoomableImage({ width, height, onTap, onDismiss, onZoomed, backdrop, ...image }: ImageProps & { width: number; height: number; onTap: () => void; onDismiss: () => void; /** The pager stops swiping while the image is enlarged. */ onZoomed: (zoomed: boolean) => void; backdrop: string }) {
  const reduceMotion = useReducedMotion();
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const drop = useSharedValue(0);
  const dropVelocity = useSharedValue(0);

  const settle = (to: number) => {
    'worklet';

    return reduceMotion ? withTiming(to, { duration: 120 }) : withSpring(to, Spring);
  };

  const zoomChanged = (next: boolean) => {
    setZoomed(next);
    onZoomed(next);
  };

  // Taps are told apart here, not by racing two recognisers: a second tap
  // within the window zooms, a lone one closes once the window has passed.
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  const toggleZoom = () => {
    const next = scale.get() > 1 ? 1 : DoubleTapScale;
    scale.set(settle(next));
    x.set(settle(0));
    y.set(settle(0));
    zoomChanged(next > 1);
  };

  const tapped = () => {
    const now = Date.now();

    if (pendingTap.current && now - lastTap.current < SecondTapWithin) {
      clearTimeout(pendingTap.current);
      pendingTap.current = null;
      lastTap.current = 0;
      toggleZoom();

      return;
    }

    lastTap.current = now;
    pendingTap.current = setTimeout(() => {
      pendingTap.current = null;
      onTap();
    }, SecondTapWithin);
  };

  useEffect(
    () => () => {
      if (pendingTap.current) {
        clearTimeout(pendingTap.current);
      }
    },
    [],
  );

  // Keeps the enlarged image over the screen: no empty band past its edges.
  const bound = (value: number, size: number, factor: number) => {
    'worklet';
    const room = Math.max(0, (size * factor - size) / 2);

    return clamp(value, -room, room);
  };

  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      startScale.set(scale.get());
    },
    onUpdate: (event) => {
      'worklet';
      scale.set(clamp(startScale.get() * event.scale, 1, MaxScale));
    },
    onFinalize: () => {
      'worklet';
      const next = scale.get() < 1.05 ? 1 : scale.get();
      scale.set(settle(next));
      x.set(settle(bound(x.get(), width, next)));
      y.set(settle(bound(y.get(), height, next)));
      runOnJS(zoomChanged)(next > 1);
    },
  });

  // Enlarged: the finger moves the image. At rest: only a downward drag counts, and it closes the viewer.
  const pan = usePanGesture({
    maxPointers: 1,
    activeOffsetX: zoomed ? [-4, 4] : undefined,
    activeOffsetY: zoomed ? [-4, 4] : [-12, 12],
    failOffsetX: zoomed ? undefined : [-12, 12],
    onActivate: () => {
      'worklet';
      startX.set(x.get());
      startY.set(y.get());
    },
    onUpdate: (event) => {
      'worklet';

      if (scale.get() > 1) {
        x.set(startX.get() + event.translationX);
        y.set(startY.get() + event.translationY);
      } else {
        drop.set(Math.max(0, event.translationY));
        dropVelocity.set(event.velocityY);
      }
    },
    onFinalize: () => {
      'worklet';

      if (scale.get() > 1) {
        x.set(settle(bound(x.get(), width, scale.get())));
        y.set(settle(bound(y.get(), height, scale.get())));

        return;
      }

      if (drop.get() > DismissDistance || dropVelocity.get() > DismissVelocity) {
        drop.set(withTiming(height, { duration: reduceMotion ? 0 : 180 }));
        runOnJS(onDismiss)();
      } else {
        drop.set(settle(0));
      }
    },
  });

  const tap = useTapGesture({
    numberOfTaps: 1,
    onActivate: () => {
      'worklet';
      runOnJS(tapped)();
    },
  });

  const gesture = useCompetingGestures(useSimultaneousGestures(pinch, pan), tap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() + drop.get() }, { scale: scale.get() }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drop.get(), [0, height / 2], [1, 0], 'clamp'),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={{ width, height }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: backdrop }, backdropStyle]} />
        <Animated.View style={[{ width, height }, imageStyle]}>
          <Image {...image} style={{ width, height }} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
