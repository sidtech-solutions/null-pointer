import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tick under the thumb, so a star, vote, push or reaction feels taken before the request answers. */
export function tap(): void {
  if (Platform.OS === 'web') {
    return;
  }

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

const kinds = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
} as const;

/**
 * The outcome of something the person asked for: a commit posted, a report
 * received, a request refused. One per outcome, on the same frame as the
 * toast or error it accompanies, never as the only feedback.
 */
export function notify(kind: keyof typeof kinds): void {
  if (Platform.OS === 'web') {
    return;
  }

  Haptics.notificationAsync(kinds[kind]).catch(() => {});
}
