const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-crypto'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const nodeModules = ['stream', 'events', 'http', 'https', 'url', 'querystring', 'path', 'fs', 'net', 'tls', 'zlib', 'ws'];
  if (nodeModules.includes(moduleName)) {
    return {
      type: 'empty',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
