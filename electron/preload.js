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
  onOAuthCompleted: (callback) => ipcRenderer.on('oauth-completed', callback),
  removeOAuthListeners: () => {
    ipcRenderer.removeAllListeners('oauth-callback');
    ipcRenderer.removeAllListeners('oauth-completed');
  },
  
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
  offUpdateDownloaded: (callback) => ipcRenderer.removeListener('update-downloaded', callback),

  hardware: {
    getStatus: () => ipcRenderer.invoke('hardware:get-status'),
    refreshDevices: () => ipcRenderer.invoke('hardware:refresh-devices'),
    openCashDrawer: (deviceId) => ipcRenderer.invoke('hardware:cash-drawer-open', deviceId ?? null),
    startCardTransaction: (payload) => ipcRenderer.invoke('hardware:card-transaction-start', payload ?? {}),
    cancelCardTransaction: (reason) => ipcRenderer.invoke('hardware:card-transaction-cancel', reason),
    simulateScan: (payload) => ipcRenderer.invoke('hardware:simulate-scan', payload ?? {}),
    onEvent: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('hardware:event', handler)
      return () => ipcRenderer.removeListener('hardware:event', handler)
    },
    onScannerData: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('hardware:scanner-data', handler)
      return () => ipcRenderer.removeListener('hardware:scanner-data', handler)
    },
  },

  // Receipt printer bridge
  receiptPrinter: {
    printEscPos: (payload) => ipcRenderer.invoke('receipt-printer:print-escpos', payload),
  },
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