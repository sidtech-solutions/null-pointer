import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tick under the thumb, so a star, vote, push or reaction feels taken before the request answers. */
export function tap(): void {
  if (Platform.OS === 'web') {
    return;
  }

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
