const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Only apply proxy in development (dev server only)
  if (config.mode !== 'production') {
    config.devServer = config.devServer || {};
    // If devServer is a function in some versions, normalize to object
    if (typeof config.devServer === 'function') {
      config.devServer = config.devServer();
    }

    config.devServer.proxy = Object.assign({}, config.devServer.proxy, {
      '/api': {
        target: 'https://testnet.omni.apex.exchange',
        changeOrigin: true,
        secure: true,
        // Preserve "/api" prefix so `/api/v3/...` -> `https://.../api/v3/...`
        pathRewrite: (path) => path,
      },
    });
  }

  return config;
};

