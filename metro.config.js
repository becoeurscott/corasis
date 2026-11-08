// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @insforge/sdk has a Node-only branch with `await import("crypto")`. It never
// runs on device (global crypto is used there), but Metro must still resolve it.
const empty = path.resolve(__dirname, 'shims/empty.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'crypto' && platform !== 'web') return { type: 'sourceFile', filePath: empty };
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

// 3D model files for the life game (shared/models/*.glb).
if (!config.resolver.assetExts.includes('glb')) config.resolver.assetExts.push('glb');

module.exports = config;
