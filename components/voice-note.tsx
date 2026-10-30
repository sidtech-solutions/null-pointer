import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Pause, Play, Square, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import type { MessageVoice } from '@/lib/types';
import { formatVoiceTime, type VoiceDraft, VoiceLimits, VoiceSpeeds, waveformOf } from '@/lib/voice-notes';

const WaveHeight = 28;

/** The bars of a voice note; the played part in full colour, the rest faded. */
export function Waveform({ bars, played = 0, tint, height = WaveHeight, style }: { bars: number[]; played?: number; tint: string; height?: number; style?: ViewStyle }) {
  const playedBars = Math.round(Math.min(1, Math.max(0, played)) * bars.length);

  return (
    <View style={[styles.wave, { height }, style]} pointerEvents="none">
      {bars.map((bar, index) => (
        <View key={index} style={[styles.bar, { height: Math.max(3, (bar / 100) * height), backgroundColor: tint, opacity: index < playedBars ? 1 : 0.4 }]} />
      ))}
    </View>
  );
}

/** Only one voice note plays at a time, wherever it is. */
let playingNow: AudioPlayer | null = null;
let audioMode: Promise<void> | null = null;

function readyToPlay(): Promise<void> {
  audioMode ??= setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' }).catch(() => undefined);

  return audioMode;
}

type PlayState = 'idle' | 'loading' | 'playing' | 'paused';

/**
 * A voice note in a bubble or the composer. Nothing is downloaded until play is pressed. The clock counts the time
 * the note takes at its speed, so 0:14 at 2× reads 0:07; tapping the bars seeks.
 */
export function VoiceNote({ voice, tint, compact = false }: { voice: MessageVoice | VoiceDraft; tint: string; compact?: boolean }) {
  const duration = Math.max(1, voice.duration_ms);
  const player = useRef<AudioPlayer | null>(null);
  const [state, setState] = useState<PlayState>('idle');
  const [at, setAt] = useState(0);
  const [speed, setSpeed] = useState<(typeof VoiceSpeeds)[number]>(1);
  const width = useRef(0);

  useEffect(
    () => () => {
      const current = player.current;

      if (current) {
        if (playingNow === current) {
          playingNow = null;
        }

        current.remove();
      }
    },
    [],
  );

  // Registered once, so it never reads `state`; the functional updates keep a pause the person asked for.
  const onStatus = (status: AudioStatus) => {
    setAt(status.currentTime * 1000);

    if (status.didJustFinish) {
      // Pause before rewinding: seeking a finished player starts it again on Android.
      player.current?.pause();
      setState('idle');
      setAt(0);
      player.current?.seekTo(0).catch(() => undefined);

      if (playingNow === player.current) {
        playingNow = null;
      }
    } else if (status.playing) {
      setState('playing');
    }
  };

  const ensure = async (): Promise<AudioPlayer> => {
    if (player.current) {
      return player.current;
    }

    await readyToPlay();

    const created = createAudioPlayer({ uri: 'url' in voice ? voice.url : voice.uri }, { updateInterval: 200 });

    created.addListener('playbackStatusUpdate', onStatus);
    created.setPlaybackRate(speed, 'high');
    player.current = created;

    return created;
  };

  const toggle = async () => {
    if (state === 'playing') {
      player.current?.pause();
      setState('paused');

      return;
    }

    setState('loading');

    try {
      const current = await ensure();

      if (playingNow && playingNow !== current) {
        playingNow.pause();
      }

      playingNow = current;
      current.play();
    } catch {
      setState('idle');
    }
  };

  const cycleSpeed = () => {
    const next = VoiceSpeeds[(VoiceSpeeds.indexOf(speed) + 1) % VoiceSpeeds.length];

    setSpeed(next);
    player.current?.setPlaybackRate(next, 'high');
  };

  const seek = async (fraction: number) => {
    const current = await ensure();
    const target = Math.min(1, Math.max(0, fraction)) * duration;

    setAt(target);
    await current.seekTo(target / 1000).catch(() => undefined);
  };

  const played = Math.min(1, at / duration);
  const clock = formatVoiceTime((at > 0 ? at : duration) / speed);

  return (
    <View style={[styles.note, compact && styles.noteCompact]} accessibilityLabel={`Voice note, ${formatVoiceTime(duration)}`}>
      <Pressable onPress={toggle} style={[styles.play, { borderColor: tint }]} accessibilityRole="button" accessibilityLabel={state === 'playing' ? 'Pause' : 'Play'} hitSlop={6}>
        {state === 'loading' ? <ActivityIndicator size="small" color={tint} /> : state === 'playing' ? <Pause size={16} color={tint} strokeWidth={2} fill={tint} /> : <Play size={16} color={tint} strokeWidth={2} fill={tint} style={styles.playIcon} />}
      </Pressable>
      <Pressable
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        onPress={(event) => seek(width.current > 0 ? event.nativeEvent.locationX / width.current : 0)}
        style={styles.bars}
        accessibilityRole="adjustable"
        accessibilityLabel="Position"
        accessibilityValue={{ min: 0, max: Math.floor(duration / 1000), now: Math.floor(at / 1000), text: `${formatVoiceTime(at)} of ${formatVoiceTime(duration)}` }}>
        <Waveform bars={voice.waveform.length > 0 ? voice.waveform : waveformOf([])} played={played} tint={tint} height={compact ? 22 : WaveHeight} />
      </Pressable>
      <View style={styles.side}>
        <Text variant="mono" color={tint} style={styles.clock}>{clock}</Text>
        <Pressable onPress={cycleSpeed} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Speed ${speed}×`} style={[styles.speed, { borderColor: tint }]}>
          <Text variant="mono" color={tint} style={styles.speedText}>{speed}×</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The composer while a voice note records: the time, the last couple of seconds of sound, cancel and stop. */
export function RecordingBar({ durationMs, peak, stopping, onCancel, onStop }: { durationMs: number; peak: () => number; stopping: boolean; onCancel: () => void; onStop: () => void }) {
  const theme = useTheme();
  const [recent, setRecent] = useState<number[]>([]);
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  // The waveform samples the microphone ten times a second; that is data, not motion, so it stays on a timer.
  useEffect(() => {
    const timer = setInterval(() => setRecent((current) => [...current.slice(-23), peak()]), 100);

    return () => clearInterval(timer);
  }, [peak]);

  // The dot breathes on the UI thread; under Reduce Motion it simply stays lit.
  useEffect(() => {
    pulse.set(reduceMotion ? 1 : withRepeat(withTiming(0.3, { duration: 500 }), -1, true));
  }, [pulse, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  const left = Math.max(0, VoiceLimits.maxMs - durationMs);

  return (
    <View style={[styles.recording, { backgroundColor: theme.wash }]} accessibilityLiveRegion="polite" accessibilityLabel={`Recording, ${formatVoiceTime(durationMs)}`}>
      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel recording" style={styles.recordingButton}>
        <X size={20} color={theme.inkMuted} strokeWidth={2} />
      </Pressable>
      <Animated.View style={[styles.dot, { backgroundColor: theme.destructive }, dotStyle]} />
      <Text variant="mono" style={styles.clock}>{formatVoiceTime(durationMs)}</Text>
      <Waveform bars={waveformOf(recent, 24)} played={1} tint={theme.ink} height={22} style={styles.recent} />
      {left <= 10_000 && <Text variant="mono" muted style={styles.left}>-{formatVoiceTime(left)}</Text>}
      <Pressable onPress={onStop} disabled={stopping} hitSlop={8} accessibilityRole="button" accessibilityLabel="Stop recording" style={[styles.stop, { backgroundColor: theme.primary }]}>
        {stopping ? <ActivityIndicator size="small" color={theme.primaryInk} /> : <Square size={14} color={theme.primaryInk} strokeWidth={2} fill={theme.primaryInk} />}
      </Pressable>
    </View>
  );
}

/** A recorded voice note waiting above the composer, with a way to drop it. */
export function VoiceDraftStrip({ draft, onDiscard }: { draft: VoiceDraft; onDiscard: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.draft, { backgroundColor: theme.wash }]}>
      <View style={styles.draftNote}>
        <VoiceNote voice={draft} tint={theme.ink} compact />
      </View>
      <Pressable onPress={onDiscard} hitSlop={8} accessibilityRole="button" accessibilityLabel="Discard voice note">
        <Trash2 size={18} color={theme.inkMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wave: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  bar: { flex: 1, marginHorizontal: 1, borderRadius: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 220, paddingVertical: 2 },
  noteCompact: { minWidth: 0, flex: 1 },
  play: { width: 32, height: 32, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  playIcon: { marginLeft: 2 },
  bars: { flex: 1, justifyContent: 'center' },
  side: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clock: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  speed: { height: 22, minWidth: 38, paddingHorizontal: 8, borderWidth: 1, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  speedText: { fontSize: 11, lineHeight: 14, includeFontPadding: false, textAlignVertical: 'center' },
  recording: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingLeft: 6, paddingRight: 4, borderRadius: 20 },
  recordingButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  recent: { flex: 1 },
  left: { fontSize: 11 },
  stop: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg },
  draftNote: { flex: 1 },
});
