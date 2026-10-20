// CI sets APP_VERSION (from the release tag) and BUILD_NUMBER (the run number).
module.exports = ({ config }) => {
  const version = process.env.APP_VERSION || config.version;
  const buildNumber = process.env.BUILD_NUMBER;

  return {
    ...config,
    version,
    ios: {
      ...config.ios,
      buildNumber: buildNumber || config.ios.buildNumber,
    },
    android: {
      ...config.android,
      versionCode: buildNumber ? Number(buildNumber) : config.android.versionCode,
    },
  };
};
