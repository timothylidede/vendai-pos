export const getFirebaseAuthErrorMessage = (error: any): string => {
  if (error?.code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized. Please check Firebase console settings.';
  }
  if (error?.code === 'auth/popup-blocked') {
    return 'Pop-up was blocked. Using redirect method instead...';
  }
  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
    return 'Sign in was cancelled. Click the button again to continue.';
  }
  if (error?.code === 'auth/network-request-failed') {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (error?.code === 'auth/too-many-requests') {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }
  if (error?.code === 'auth/invalid-action-code') {
    return 'Sign-in request expired or invalid. Please try again.';
  }
  if (typeof error?.message === 'string') {
    if (error.message.includes('The requested action is invalid')) {
      return 'Sign-in request expired. Please try again.';
    }
    if (error.message.includes('OAuth timeout') || error.message.includes('timeout')) {
      return 'Sign in timed out. Please try again.';
    }
    if (error.message.includes('cancelled') || error.message.includes('closed')) {
      return 'Sign in was cancelled. Click the button again to continue.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your internet connection and try again.';
    }
  }
  return 'An error occurred during sign in. Please try again.';
};
