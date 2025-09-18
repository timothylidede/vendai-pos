const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  // Only notarize if we have the required environment variables
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASS) {
    console.warn('Skipping notarization: APPLE_ID and APPLE_ID_PASS environment variables not set');
    return;
  }

  return await notarize({
    appBundleId: 'com.vendai.pos',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASS,
  });
};