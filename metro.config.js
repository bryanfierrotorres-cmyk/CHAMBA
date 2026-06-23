const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure web platform is present
if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms = [...config.resolver.platforms, 'web'];
}

// Enable aggressive optimizations for production builds
config.transformer = {
  ...config.transformer,
  // Inline requires reduces initial bundle size by loading modules on demand
  inlineRequires: true,
  // Enable experimental import support for better tree‑shaking
  experimentalImportSupport: true,
  // Uncomment the line below to use esbuild (requires expo-esbuild package)
  // babelTransformerPath: require.resolve('expo-esbuild'),
};

// Stub native modules that break on web
const WEB_STUBS = {
  'react-native-maps': path.resolve(__dirname, 'src/stubs/react-native-maps.web.tsx'),
  '@stripe/stripe-react-native': path.resolve(__dirname, 'src/stubs/stripe-react-native.web.ts'),
};

const originalResolver = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { filePath: WEB_STUBS[moduleName], type: 'sourceFile' };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
