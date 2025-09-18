// Global type declarations for Electron preload APIs

export {};

declare global {
  interface Window {
    electronAPI?: {
      getVersion: () => Promise<string>;
      showMessageBox: (options: any) => Promise<any>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      googleOAuth: () => Promise<{
        success: boolean;
        user?: { id: string; email: string; name: string; picture?: string };
        tokens?: { accessToken?: string; idToken?: string };
      }>;
      onOAuthCallback: (callback: (event: any, url: string) => void) => void;
      removeAllListeners: (channel: string) => void;
      platform: string;
      versions: { node: string; chrome: string; electron: string };
      
      // Update management
      checkForUpdates: () => Promise<{
        available: boolean;
        updateInfo?: any;
        error?: string;
        message?: string;
      }>;
      downloadUpdate: () => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;
      installUpdate: () => boolean;
      getAppVersion: () => Promise<string>;
      
      // Update event listeners
      onUpdateChecking: (callback: () => void) => void;
      offUpdateChecking: (callback: () => void) => void;
      
      onUpdateAvailable: (callback: (info: {
        version: string;
        releaseNotes?: string;
        releaseDate?: string;
      }) => void) => void;
      offUpdateAvailable: (callback: (info: any) => void) => void;
      
      onUpdateNotAvailable: (callback: () => void) => void;
      offUpdateNotAvailable: (callback: () => void) => void;
      
      onUpdateError: (callback: (error: string) => void) => void;
      offUpdateError: (callback: (error: string) => void) => void;
      
      onUpdateDownloadProgress: (callback: (progress: {
        percent: number;
        transferred: number;
        total: number;
        bytesPerSecond: number;
      }) => void) => void;
      offUpdateDownloadProgress: (callback: (progress: any) => void) => void;
      
      onUpdateDownloaded: (callback: (info: {
        version: string;
        releaseNotes?: string;
      }) => void) => void;
      offUpdateDownloaded: (callback: (info: any) => void) => void;
    };
    vendaiAPI?: {
      isElectron: boolean;
      showNotification: (title: string, body: string) => void;
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
    };
  }
}
