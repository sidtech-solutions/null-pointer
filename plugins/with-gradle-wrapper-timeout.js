const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// The template's 10s wrapper download timeout is too short for the CI runner.
const Timeout = 300000;

module.exports = function withGradleWrapperTimeout(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties');
      const properties = fs.readFileSync(file, 'utf8');
      const updated = /^networkTimeout=.*$/m.test(properties)
        ? properties.replace(/^networkTimeout=.*$/m, `networkTimeout=${Timeout}`)
        : `${properties.trimEnd()}\nnetworkTimeout=${Timeout}\n`;

      fs.writeFileSync(file, updated);

      return config;
    },
  ]);
};
