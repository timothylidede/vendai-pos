'use client';

import { Wrapper } from '@googlemaps/react-wrapper';
import { ReactNode } from 'react';

interface GoogleMapsWrapperProps {
  children: ReactNode;
  apiKey: string;
}

export function GoogleMapsWrapper({ children, apiKey }: GoogleMapsWrapperProps) {
  const render = (status: any) => {
    switch (status) {
      case 'LOADING':
        return <div className="text-slate-400 text-sm">Loading maps...</div>;
      case 'FAILURE':
        return <div className="text-red-400 text-sm">Error loading maps</div>;
      case 'SUCCESS':
        return <>{children}</>;
      default:
        return <>{children}</>;
    }
  };

  return (
    <Wrapper apiKey={apiKey} libraries={['places']} render={render} />
  );
}