module.exports = ({ config }) => {
  const version = process.env.APP_VERSION || config.version;
  const buildNumber = process.env.BUILD_NUMBER;
  // Calls ride on WebRTC, left out of the F-Droid build (see react-native.config.js).
  const withCalls = process.env.NULL_POINTER_CALLS !== '0';

  return {
    ...config,
    version,
    ios: {
      ...config.ios,
      buildNumber: buildNumber || config.ios.buildNumber,
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(withCalls
        ? [
            // The usage strings come from expo-image-picker's plugin in app.json, which runs after this one.
            '@config-plugins/react-native-webrtc',
          ]
        : []),
    ],
  };
};
