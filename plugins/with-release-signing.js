const { withAppBuildGradle } = require('expo/config-plugins');

// Adds a release signingConfig to app/build.gradle that reads the keystore from
// ANDROID_KEYSTORE_* env vars and falls back to the debug keystore when unset.
const DebugSigning = `            keyPassword 'android'
        }
    }
    buildTypes {`;

const ReleaseSigning = `            keyPassword 'android'
        }
        release {
            def keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (keystorePath != null && file(keystorePath).exists()) {
                storeFile file(keystorePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }
    buildTypes {`;

const ReleaseUsesDebug = /\/\/ Caution! In production, you need to generate your own keystore file\.\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n\s*signingConfig signingConfigs\.debug/;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;

    if (gradle.includes('signingConfigs.release')) {
      return config;
    }

    if (!gradle.includes(DebugSigning) || !ReleaseUsesDebug.test(gradle)) {
      throw new Error('with-release-signing: android/app/build.gradle does not look like the Expo template; update the plugin.');
    }

    config.modResults.contents = gradle.replace(DebugSigning, ReleaseSigning).replace(ReleaseUsesDebug, 'signingConfig signingConfigs.release');

    return config;
  });
};
