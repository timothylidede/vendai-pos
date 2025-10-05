// Global type declarations for Electron preload APIs

export {};

declare global {
  type HardwareDeviceType = 'barcode-scanner' | 'cash-drawer' | 'card-reader'

  interface HardwareDeviceInfo {
    id: string
    label: string
    type: HardwareDeviceType
    connected: boolean
    simulated?: boolean
    transport?: string
    vendorId?: number
    productId?: number
    path?: string
    lastSeenAt?: number
    error?: string | null
  }

  interface HardwareStatusSnapshot {
    scanners: HardwareDeviceInfo[]
    cashDrawers: HardwareDeviceInfo[]
    cardReaders: HardwareDeviceInfo[]
    updatedAt: number
  }

  interface HardwareScannerEvent {
    deviceId?: string
    data: string
    at: number
    simulated?: boolean
  }

  interface HardwareRendererEvent<T = unknown> {
    type: string
    payload?: T
  }

  interface CardTransactionRequest {
    readerId?: string
    orderId?: string
    amount: number
    currency?: string
    metadata?: Record<string, unknown>
  }

  interface CardTransactionResponse {
    success: boolean
    status?: 'approved' | 'declined' | 'cancelled' | 'error' | 'processing' | 'idle'
    referenceId?: string
    message?: string
    error?: string
    raw?: unknown
  }

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

      // POS payment bridges
      payments?: {
        openCashDrawer?: () => Promise<void>;
        processCardPayment?: (payload: {
          amount: number;
          currency: string;
          orderId: string;
        }) => Promise<{
          success: boolean;
          referenceId?: string;
          message?: string;
          error?: string;
        }>;
      };
      receiptPrinter?: {
        printEscPos?: (payload: {
          commandsBase64: string;
          jobName?: string;
        }) => Promise<void>;
      };
      hardware?: {
        getStatus: () => Promise<HardwareStatusSnapshot>;
        refreshDevices: () => Promise<HardwareStatusSnapshot>;
        openCashDrawer: (deviceId?: string | null) => Promise<{
          success: boolean;
          deviceId?: string;
          openedAt?: number;
          error?: string;
        }>;
        startCardTransaction: (payload: CardTransactionRequest) => Promise<CardTransactionResponse>;
        cancelCardTransaction: (reason?: string) => Promise<CardTransactionResponse>;
        simulateScan: (payload: { data: string; deviceId?: string }) => Promise<HardwareScannerEvent>;
        onEvent: (callback: (event: HardwareRendererEvent) => void) => () => void;
        onScannerData: (callback: (event: HardwareScannerEvent) => void) => () => void;
      };
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
