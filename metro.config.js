const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro ya resuelve *.web.* por plataforma; no anteponer web.* en sourceExts
// (rompe node_modules de react-native: TextInputState, Utilities/Platform, etc.).
if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms = [...config.resolver.platforms, 'web'];
}

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
