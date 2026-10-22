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
  };
};
