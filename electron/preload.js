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
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onWindowStateChanged: (callback) => ipcRenderer.on('window-state-changed', callback),
  
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
  }
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