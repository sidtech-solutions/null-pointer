// Calls need WebRTC, whose Android and iOS builds pull a prebuilt binary that
// F-Droid does not accept. The F-Droid recipe builds with NULL_POINTER_CALLS=0,
// which leaves the module out of the native build; the JS notices it is missing
// and hides every call control.
const withoutCalls = process.env.NULL_POINTER_CALLS === '0';

module.exports = {
  dependencies: withoutCalls
    ? {
        'react-native-webrtc': { platforms: { android: null, ios: null } },
      }
    : {},
};
