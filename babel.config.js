module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  if (process.env.NODE_ENV === 'production') {
    // Elimina console.* excepto error y warn en producción
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      ...plugins,
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@context': './src/context',
            '@features': './src/features',
            '@navigation': './src/navigation',
            '@store': './src/store',
            '@services': './src/services',
            '@utils': './src/utils',
            '@constants': './src/constants',
            '@hooks': './src/hooks',
          },
        },
      ],
    ],
  };
};
