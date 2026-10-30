import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { MediaStream } from 'react-native-webrtc';

import { Avatar } from '@/components/avatar';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { acceptCall, callDuration, type CallState, declineCall, dismissCall, hangUp, toggleCamera, toggleMicrophone } from '@/lib/call';
import { useNow } from '@/lib/now';
import { toast } from '@/lib/toast';
import { webrtc } from '@/lib/webrtc';

/** What the call is doing, in a few words, for the console and the bar alike. */
export function callStatusText(state: Exclude<CallState, { status: 'idle' }>, now: number): string {
  switch (state.status) {
    case 'calling':
      return 'Calling…';
    case 'ringing':
      return 'Incoming call';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return callDuration(state.startedAt, now);
    case 'ended':
      return state.reason;
  }
}

/** One camera, ours mirrored as a mirror would show it. */
function CameraView({ stream, mirror = false }: { stream: MediaStream; mirror?: boolean }) {
  const theme = useTheme();
  const rtc = webrtc();

  if (!rtc) {
    return null;
  }

  const { RTCView } = rtc;

  return <RTCView streamURL={stream.toURL()} objectFit="cover" mirror={mirror} style={[styles.camera, { backgroundColor: theme.shell }]} />;
}

/** A round control: mute, camera, hang up. 48pt, a thumb target. */
export function CallControl({ label, onPress, tone = 'plain', active = false, children }: { label: string; onPress: () => void; tone?: 'plain' | 'end' | 'accept'; active?: boolean; children: ReactNode }) {
  const theme = useTheme();
  const fill = tone === 'end' ? theme.destructive : tone === 'accept' ? theme.success : active ? theme.ink : theme.wash;

  return (
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.control, { backgroundColor: fill, opacity: pressed ? 0.8 : 1 }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
      {children}
    </Pressable>
  );
}

/**
 * The call on top of the thread's composer: confirming, ringing, connecting,
 * then the call itself with its timer, mute, camera and Hang up, and for a
 * moment why it ended. Only the call with this thread's partner shows here.
 */
export function CallConsole({ state }: { state: Exclude<CallState, { status: 'idle' }> }) {
  const theme = useTheme();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const connected = state.status === 'connected' ? state : null;
  const inkOnControl = theme.primaryInk;
  const showsCameras = connected !== null && (connected.camera !== null || (connected.isPartnerCameraOn && connected.partnerCamera !== null));

  // A camera that stops being sent leaves the screen when its stream goes.
  useEffect(() => () => setBusy(false), []);

  const camera = async () => {
    setBusy(true);
    const problem = await toggleCamera();
    setBusy(false);

    if (problem) {
      toast(problem);
    }
  };

  return (
    <View style={[styles.console, { backgroundColor: theme.wash, borderColor: theme.hairline }]} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Avatar user={state.partner} size={36} />
        <View style={styles.titles}>
          <Text variant="name" numberOfLines={1}>{state.partner.name || `@${state.partner.handle}`}</Text>
          <Text variant="mono" muted numberOfLines={1} style={styles.status}>
            {callStatusText(state, now)}
            {connected?.code ? `  ·  fp ${connected.code}` : ''}
          </Text>
        </View>
        {state.status === 'ended' && (
          <Pressable onPress={dismissCall} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
            <X size={18} color={theme.inkMuted} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {showsCameras && connected && (
        <View style={styles.cameras}>
          {connected.isPartnerCameraOn && connected.partnerCamera && <CameraView stream={connected.partnerCamera} />}
          {connected.camera && <CameraView stream={connected.camera} mirror />}
        </View>
      )}

      {state.status === 'ringing' && (
        <View style={styles.actions}>
          <CallControl label="Decline" tone="end" onPress={declineCall}>
            <PhoneOff size={20} color={inkOnControl} strokeWidth={2} />
          </CallControl>
          <CallControl label="Accept" tone="accept" onPress={() => void acceptCall()}>
            <Phone size={20} color={inkOnControl} strokeWidth={2} />
          </CallControl>
        </View>
      )}

      {(state.status === 'calling' || state.status === 'connecting') && (
        <View style={styles.actions}>
          <CallControl label="Hang up" tone="end" onPress={hangUp}>
            <PhoneOff size={20} color={inkOnControl} strokeWidth={2} />
          </CallControl>
        </View>
      )}

      {connected && (
        <View style={styles.actions}>
          <CallControl label={connected.isMicMuted ? 'Unmute microphone' : 'Mute microphone'} active={connected.isMicMuted} onPress={toggleMicrophone}>
            {connected.isMicMuted ? <MicOff size={20} color={theme.surface} strokeWidth={2} /> : <Mic size={20} color={theme.ink} strokeWidth={2} />}
          </CallControl>
          <CallControl label={connected.camera ? 'Turn camera off' : 'Turn camera on'} active={connected.camera !== null} onPress={() => void (busy ? null : camera())}>
            {connected.camera ? <Video size={20} color={theme.surface} strokeWidth={2} /> : <VideoOff size={20} color={theme.ink} strokeWidth={2} />}
          </CallControl>
          <CallControl label="Hang up" tone="end" onPress={hangUp}>
            <PhoneOff size={20} color={inkOnControl} strokeWidth={2} />
          </CallControl>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  console: { marginHorizontal: Space.gutter, marginBottom: 8, padding: 12, gap: 12, borderRadius: Radius.lg, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titles: { flex: 1, gap: 2 },
  status: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  cameras: { flexDirection: 'row', gap: 8 },
  camera: { flex: 1, aspectRatio: 3 / 4, borderRadius: Radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  control: { width: 48, height: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
