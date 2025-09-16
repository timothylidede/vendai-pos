'use client';

import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { ReactNode } from 'react';
import { GoogleMapsProvider } from '@/contexts/google-maps-context';

interface GoogleMapsWrapperProps {
  children: ReactNode;
  apiKey: string;
}

// Ensure consistent library loading across all components
const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "geocoding")[] = ['places', 'geometry', 'geocoding'];
const GOOGLE_MAPS_VERSION = 'weekly';

export function GoogleMapsWrapper({ children, apiKey }: GoogleMapsWrapperProps) {
  if (!apiKey) {
    console.warn('Google Maps API key is missing');
    return (
      <GoogleMapsProvider isLoaded={false} loadError="API key missing">
        <div className="text-yellow-400 text-sm p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
          Google Maps API key is not configured. Location picker will work with manual input only.
          {children}
        </div>
      </GoogleMapsProvider>
    );
  }

  // Debug logging to help identify conflicts
  if (process.env.NODE_ENV === 'development') {
    console.log('GoogleMapsWrapper initializing with:', {
      apiKey: apiKey?.slice(0, 20) + '...',
      libraries: GOOGLE_MAPS_LIBRARIES,
      version: GOOGLE_MAPS_VERSION
    });
  }

  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return (
          <GoogleMapsProvider isLoaded={false} loadError={null}>
            <div className="flex items-center justify-center p-4">
              <div className="text-slate-400 text-sm">Loading Google Maps...</div>
            </div>
          </GoogleMapsProvider>
        );
      case Status.FAILURE:
        console.error('Google Maps failed to load');
        return (
          <GoogleMapsProvider isLoaded={false} loadError="Failed to load Google Maps">
            <div className="text-red-400 text-sm p-4 bg-red-400/10 border border-red-400/20 rounded-lg">
              Error loading Google Maps. Please check your API key and internet connection.
              <div className="mt-2 opacity-60">
                {children}
              </div>
            </div>
          </GoogleMapsProvider>
        );
      case Status.SUCCESS:
        return (
          <GoogleMapsProvider isLoaded={true} loadError={null}>
            {children}
          </GoogleMapsProvider>
        );
      default:
        return (
          <GoogleMapsProvider isLoaded={false} loadError={null}>
            {children}
          </GoogleMapsProvider>
        );
    }
  };

  return (
    <Wrapper 
      apiKey={apiKey} 
      libraries={GOOGLE_MAPS_LIBRARIES} 
      render={render}
      version={GOOGLE_MAPS_VERSION}
    />
  );
}