const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Leaves release builds unsigned. The Expo template signs release builds with
 * the debug keystore; this removes that so `assembleRelease` and
 * `bundleRelease` produce app-release-unsigned.apk and an unsigned AAB.
 *
 * CI signs them afterwards with apksigner and jarsigner (see
 * .github/workflows/build.yml). F-Droid builds the same unsigned APK and
 * checks it against the one CI signed, so the two builds must be identical:
 * keeping signing out of Gradle keeps the Gradle invocation the same on both
 * sides.
 *
 * The generated android/ directory is never edited by hand; this rewrites
 * app/build.gradle during prebuild.
 */
const ReleaseUsesDebug = /\n\s*\/\/ Caution! In production, you need to generate your own keystore file\.\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n\s*signingConfig signingConfigs\.debug\n/;

module.exports = function withUnsignedRelease(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;

    if (!ReleaseUsesDebug.test(gradle)) {
      if (/release\s*\{[^}]*signingConfig/.test(gradle)) {
        throw new Error('with-unsigned-release: android/app/build.gradle does not look like the Expo template; update the plugin.');
      }
      return config;
    }

    config.modResults.contents = gradle.replace(ReleaseUsesDebug, '\n');

    return config;
  });
};
