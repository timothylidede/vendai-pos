/**
 * Environment detection utilities for VendAI
 * Determines whether the app is running in Electron desktop mode or web browser mode
 */

export function isElectron(): boolean {
  if (typeof window !== 'undefined') {
    // Check if we're in an Electron environment
    return !!(window as any).electronAPI || 
           !!(window as any).require || 
           !!(process as any).versions?.electron ||
           navigator.userAgent.toLowerCase().indexOf('electron') > -1;
  }
  return false;
}

export function isWeb(): boolean {
  return !isElectron();
}

export function isVercelDeployment(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.hostname.includes('vercel.app') || 
           window.location.hostname === 'app.vendai.digital';
  }
  return process.env.VERCEL_ENV !== undefined;
}

export function getAppEnvironment(): 'electron' | 'web' | 'vercel' {
  if (isElectron()) return 'electron';
  if (isVercelDeployment()) return 'vercel';
  return 'web';
}

export function getRedirectUrl(): string {
  const env = getAppEnvironment();
  
  if (env === 'electron') {
    return 'vendai-pos://oauth/success';
  } else if (env === 'vercel') {
    return 'https://app.vendai.digital/modules';
  } else {
    // Local development or other web deployment
    return `${window.location.origin}/modules`;
  }
}

export function shouldShowWindowControls(): boolean {
  return isElectron();
}

export function shouldShowDownloadOption(): boolean {
  return isWeb() || isVercelDeployment();
}