const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure web platform is present
if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms = [...config.resolver.platforms, 'web'];
}

// Ignore Next.js dashboard folder to avoid crashing Metro
config.resolver.blockList = [
  new RegExp(`${path.resolve(__dirname, 'telemetry-dashboard').replace(/\\/g, '\\\\')}\\/.*`),
];

// Keep transformer defaults — do NOT enable experimentalImportSupport or
// inlineRequires; they break "import React" on the web platform.
config.transformer = {
  ...config.transformer,
  inlineRequires: false,
  experimentalImportSupport: false,
};

// Stub native modules that break on web
const WEB_STUBS = {
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
