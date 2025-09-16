'use client';

import { createContext, useContext, ReactNode } from 'react';

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: string | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: null
});

export const useGoogleMaps = () => useContext(GoogleMapsContext);

interface GoogleMapsProviderProps {
  children: ReactNode;
  isLoaded: boolean;
  loadError?: string | null;
}

export function GoogleMapsProvider({ children, isLoaded, loadError = null }: GoogleMapsProviderProps) {
  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}