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
