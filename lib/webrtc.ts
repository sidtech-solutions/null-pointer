import { NativeModules } from 'react-native';

type WebRTC = typeof import('react-native-webrtc');

let loaded: WebRTC | null | undefined;

/**
 * The WebRTC module, or null in a build made without it (F-Droid leaves it
 * out, see react-native.config.js). Everything that calls checks this first
 * and stays hidden when it is null, so the rest of the app is unchanged.
 */
export function webrtc(): WebRTC | null {
  if (loaded === undefined) {
    try {
      loaded = NativeModules.WebRTCModule ? (require('react-native-webrtc') as WebRTC) : null;
    } catch {
      loaded = null;
    }
  }

  return loaded;
}

export function callsAvailable(): boolean {
  return webrtc() !== null;
}
