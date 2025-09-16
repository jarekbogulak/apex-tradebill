module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true
      }],
      // Reanimated plugin moved; use worklets plugin on RN 0.81+
      'react-native-worklets/plugin'
    ],
  };
};
