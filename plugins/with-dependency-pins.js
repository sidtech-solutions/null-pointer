const { withProjectBuildGradle } = require('expo/config-plugins');

const Marker = '// with-dependency-pins';

const Pins = [
  'com.google.code.gson:gson:2.15.0',
  'com.google.guava:guava:33.8.0-android',
  'commons-io:commons-io:2.22.0',
];

const Block = `
${Marker}: force patched versions of transitive libraries with known CVEs.
allprojects {
  configurations.all {
    resolutionStrategy {
${Pins.map((p) => `      force '${p}'`).join('\n')}
    }
  }
}
`;

module.exports = function withDependencyPins(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('with-dependency-pins: android/build.gradle is not Groovy; update the plugin.');
    }
    if (!config.modResults.contents.includes(Marker)) {
      const anchor = 'apply plugin: "expo-root-project"';
      if (!config.modResults.contents.includes(anchor)) {
        throw new Error('with-dependency-pins: android/build.gradle does not look like the Expo template; update the plugin.');
      }
      config.modResults.contents = config.modResults.contents.replace(anchor, `${Block.trim()}\n\n${anchor}`);
    }
    return config;
  });
};
