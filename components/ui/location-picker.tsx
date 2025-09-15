'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: typeof google;
  }
}

interface LocationPickerProps {
  onLocationSelect: (location: string, coordinates?: { lat: number; lng: number }) => void;
  value: string;
  placeholder?: string;
}

export function LocationPicker({ onLocationSelect, value, placeholder }: LocationPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.maps?.places && inputRef.current) {
      const autocompleteInstance = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
        fields: ['place_id', 'formatted_address', 'geometry', 'name']
      });

      autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        if (place.formatted_address) {
          const coordinates = place.geometry?.location ? {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          } : undefined;
          
          onLocationSelect(place.formatted_address, coordinates);
        }
      });

      setAutocomplete(autocompleteInstance);

      return () => {
        if (autocompleteInstance) {
          window.google.maps.event.clearInstanceListeners(autocompleteInstance);
        }
      };
    }
  }, [onLocationSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onLocationSelect(e.target.value)}
      placeholder={placeholder || "Start typing your location..."}
      className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
      autoComplete="off"
    />
  );
}