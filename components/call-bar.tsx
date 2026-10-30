import { useRouter } from 'expo-router';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CallControl, callStatusText } from '@/components/call-console';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { acceptCall, callConsoles, declineCall, hangUp, subscribeToCall, toggleMicrophone, useCall } from '@/lib/call';
import { useNow } from '@/lib/now';
import { targetParam } from '@/lib/remotes';

const Settle = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * The call over whatever screen is showing, as the web's bar at the top of
 * every page: Accept and Decline while it rings, the timer, mute and Hang up
 * once on it, and a tap to get back to the remote. It steps aside while that
 * remote's own console shows the call.
 */
export function CallBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useCall();
  const consoles = useSyncExternalStore(subscribeToCall, callConsoles, callConsoles);
  const now = useNow();

  if (state.status === 'idle' || consoles.includes(state.partner.handle)) {
    return null;
  }

  const partner = state.partner;
  const open = () => router.push({ pathname: '/remotes/[target]', params: { target: targetParam({ kind: 'direct', handle: partner.handle }) } });

  return (
    <Animated.View entering={SlideInUp.duration(280).easing(Settle)} exiting={SlideOutUp.duration(180)} style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={[styles.bar, { backgroundColor: theme.popover, borderColor: theme.hairline }]} accessibilityLiveRegion="polite">
        <Pressable onPress={open} style={({ pressed }) => [styles.body, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${callStatusText(state, now)}, @${partner.handle}. Opens the remote`}>
          <Avatar user={partner} size={32} />
          <View style={styles.titles}>
            <Text variant="name" numberOfLines={1}>{partner.name || `@${partner.handle}`}</Text>
            <Text variant="mono" muted numberOfLines={1} style={styles.status}>{callStatusText(state, now)}</Text>
          </View>
        </Pressable>

        {state.status === 'ringing' ? (
          <>
            <CallControl label="Decline" tone="end" onPress={declineCall}>
              <PhoneOff size={18} color={theme.primaryInk} strokeWidth={2} />
            </CallControl>
            <CallControl label="Accept" tone="accept" onPress={() => void acceptCall()}>
              <Phone size={18} color={theme.primaryInk} strokeWidth={2} />
            </CallControl>
          </>
        ) : state.status === 'ended' ? null : (
          <>
            {state.status === 'connected' && (
              <CallControl label={state.isMicMuted ? 'Unmute microphone' : 'Mute microphone'} active={state.isMicMuted} onPress={toggleMicrophone}>
                {state.isMicMuted ? <MicOff size={18} color={theme.surface} strokeWidth={2} /> : <Mic size={18} color={theme.ink} strokeWidth={2} />}
              </CallControl>
            )}
            <CallControl label="Hang up" tone="end" onPress={hangUp}>
              <PhoneOff size={18} color={theme.primaryInk} strokeWidth={2} />
            </CallControl>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Space.gutter, right: Space.gutter, zIndex: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  pressed: { opacity: 0.7 },
  titles: { flex: 1, gap: 2 },
  status: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
});
