const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // OAuth
  googleOAuth: () => ipcRenderer.invoke('google-oauth'),
  onOAuthCallback: (callback) => ipcRenderer.on('oauth-callback', callback),
  
  // Listen to events from main process
  onOpenPreferences: (callback) => {
    ipcRenderer.on('open-preferences', callback);
  },
  
  // Remove listener
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Platform information
  platform: process.platform,
  
  // App information
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // Update management
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Update event listeners
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  offUpdateChecking: (callback) => ipcRenderer.removeListener('update-checking', callback),
  
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  offUpdateAvailable: (callback) => ipcRenderer.removeListener('update-available', callback),
  
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  offUpdateNotAvailable: (callback) => ipcRenderer.removeListener('update-not-available', callback),
  
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),
  offUpdateError: (callback) => ipcRenderer.removeListener('update-error', callback),
  
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
  offUpdateDownloadProgress: (callback) => ipcRenderer.removeListener('update-download-progress', callback),
  
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  offUpdateDownloaded: (callback) => ipcRenderer.removeListener('update-downloaded', callback)
});

// Expose a limited API for the renderer
contextBridge.exposeInMainWorld('vendaiAPI', {
  // Add any VendAI specific APIs here
  isElectron: true,
  
  // Notification API
  showNotification: (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  },
  
  // Storage API (if needed)
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key)
  }
});