const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Removes three build-machine fingerprints from the release APK so that F-Droid's
 * build of a tag matches the one CI signs (see .github/workflows/build.yml):
 *
 * 1. The React Native Gradle plugin writes the build host's LAN IP into the
 *    `react_native_dev_server_ip` string resource unless the
 *    `reactNativeDevServerIp` Gradle property is set, which changes
 *    resources.arsc on every machine. Only debug builds on a physical device
 *    read it; `expo run:android` sets up `adb reverse`, so localhost works.
 *
 * 2. clang bakes absolute source paths (`__FILE__`, debug info) into the
 *    native libraries built from node_modules and the Gradle cache. Mapping
 *    the project root and the Gradle user home to fixed names makes those
 *    strings machine-independent.
 *
 * 3. lld's build-id hashes the pre-strip library, including NDK sysroot paths
 *    the prefix map misses. --build-id=none drops it; the NDK toolchain puts
 *    CMAKE_SHARED_LINKER_FLAGS after its own --build-id=sha1, so it wins.
 *
 * The generated android/ directory is never edited by hand; this rewrites
 * gradle.properties and the root build.gradle during prebuild.
 */
const Marker = '// with-reproducible-build';

const PrefixMapBlock = `
${Marker}: keep native libraries free of build-machine paths.
allprojects { p ->
  def prefixMapFlags = [
    "-ffile-prefix-map=\${rootProject.projectDir.parentFile.canonicalPath}=/src".toString(),
    "-ffile-prefix-map=\${gradle.gradleUserHomeDir.canonicalPath}=/gradle".toString(),
  ]
  def noBuildId = '-DCMAKE_SHARED_LINKER_FLAGS=-Wl,--build-id=none'
  ['com.android.application', 'com.android.library'].each { id ->
    p.plugins.withId(id) {
      p.extensions.getByName('androidComponents').finalizeDsl { ext ->
        ext.defaultConfig.externalNativeBuild.cmake.cFlags.addAll(prefixMapFlags)
        ext.defaultConfig.externalNativeBuild.cmake.cppFlags.addAll(prefixMapFlags)
        ext.defaultConfig.externalNativeBuild.cmake.arguments.add(noBuildId)
      }
    }
  }
}
`;

module.exports = function withReproducibleBuild(config) {
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeDevServerIp'),
    );
    config.modResults.push(
      { type: 'comment', value: 'Fixed so resources.arsc does not embed the build machine IP (with-reproducible-build).' },
      { type: 'property', key: 'reactNativeDevServerIp', value: 'localhost' },
    );
    return config;
  });

  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('with-reproducible-build: android/build.gradle is not Groovy; update the plugin.');
    }
    if (!config.modResults.contents.includes(Marker)) {
      // Must come before expo-root-project, which evaluates library projects
      // eagerly; after that it is too late to hook finalizeDsl for them.
      const anchor = 'apply plugin: "expo-root-project"';
      if (!config.modResults.contents.includes(anchor)) {
        throw new Error('with-reproducible-build: android/build.gradle does not look like the Expo template; update the plugin.');
      }
      config.modResults.contents = config.modResults.contents.replace(anchor, `${PrefixMapBlock.trim()}\n\n${anchor}`);
    }
    return config;
  });

  return config;
};
