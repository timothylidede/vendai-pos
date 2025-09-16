'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Navigation } from 'lucide-react';
import { useGoogleMaps } from '@/contexts/google-maps-context';

declare global {
  interface Window {
    google: typeof google;
  }
}

interface LocationPickerWithMapProps {
  onLocationSelect: (location: string, coordinates?: { lat: number; lng: number }) => void;
  value: string;
  placeholder?: string;
}

export function LocationPickerWithMap({ onLocationSelect, value, placeholder }: LocationPickerWithMapProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { isLoaded: isGoogleMapsLoaded, loadError } = useGoogleMaps();

  // Default location (Nairobi, Kenya)
  const defaultCenter = { lat: -1.2921, lng: 36.8219 };

  useEffect(() => {
    const initializeGoogleMaps = () => {
      if (isGoogleMapsLoaded && window.google?.maps && inputRef.current && mapRef.current) {
        console.log('Initializing Google Maps...', { isLoaded: isGoogleMapsLoaded, hasGoogle: !!window.google?.maps });
        
        try {
          // Initialize map
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            zoom: 12,
            center: currentLocation || defaultCenter,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            styles: [
              {
                "featureType": "all",
                "elementType": "geometry",
                "stylers": [{"color": "#1e293b"}]
              },
              {
                "featureType": "all",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#cbd5e1"}]
              },
              {
                "featureType": "all",
                "elementType": "labels.text.stroke",
                "stylers": [{"color": "#0f172a"}, {"weight": 2}]
              },
              {
                "featureType": "road",
                "elementType": "geometry",
                "stylers": [{"color": "#334155"}]
              },
              {
                "featureType": "road",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#94a3b8"}]
              },
              {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{"color": "#0f172a"}]
              },
              {
                "featureType": "poi",
                "elementType": "geometry",
                "stylers": [{"color": "#475569"}]
              },
              {
                "featureType": "poi",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#94a3b8"}]
              }
            ]
          });

          console.log('Map instance created:', !!mapInstance);

          // Initialize marker
          const markerInstance = new window.google.maps.Marker({
            map: mapInstance,
            position: currentLocation || defaultCenter,
            draggable: true,
            animation: window.google.maps.Animation.DROP
          });

          // Initialize autocomplete
          const autocompleteInstance = new window.google.maps.places.Autocomplete(inputRef.current, {
            types: ['establishment', 'geocode'],
            fields: ['place_id', 'formatted_address', 'geometry', 'name'],
            componentRestrictions: { country: 'ke' }
          });

          console.log('Autocomplete instance created:', !!autocompleteInstance);

          // Handle place selection from autocomplete
          autocompleteInstance.addListener('place_changed', () => {
            const place = autocompleteInstance.getPlace();
            if (place.geometry?.location && place.formatted_address) {
              const position = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              };

              // Update map and marker
              mapInstance.setCenter(position);
              mapInstance.setZoom(15);
              markerInstance.setPosition(position);
              markerInstance.setAnimation(window.google.maps.Animation.BOUNCE);
              
              setTimeout(() => {
                markerInstance.setAnimation(null);
              }, 1400);

              // Update state
              setCurrentLocation(position);
              onLocationSelect(place.formatted_address, position);
            }
          });

          // Handle marker drag
          markerInstance.addListener('dragend', () => {
            const position = markerInstance.getPosition();
            if (position) {
              const lat = position.lat();
              const lng = position.lng();
              
              // Reverse geocoding to get address
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  const address = results[0].formatted_address;
                  if (inputRef.current) {
                    inputRef.current.value = address;
                  }
                  onLocationSelect(address, { lat, lng });
                }
              });
              
              setCurrentLocation({ lat, lng });
            }
          });

          // Handle map click
          mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              
              markerInstance.setPosition({ lat, lng });
              markerInstance.setAnimation(window.google.maps.Animation.BOUNCE);
              
              setTimeout(() => {
                markerInstance.setAnimation(null);
              }, 1400);

              // Reverse geocoding
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  const address = results[0].formatted_address;
                  if (inputRef.current) {
                    inputRef.current.value = address;
                  }
                  onLocationSelect(address, { lat, lng });
                }
              });
              
              setCurrentLocation({ lat, lng });
            }
          });

          setMap(mapInstance);
          setMarker(markerInstance);
          setAutocomplete(autocompleteInstance);
          
          console.log('Google Maps initialization complete');

        } catch (error) {
          console.error('Error initializing Google Maps:', error);
        }
      } else {
        console.log('Google Maps initialization conditions not met:', {
          isLoaded: isGoogleMapsLoaded,
          hasGoogle: !!window.google?.maps,
          hasInputRef: !!inputRef.current,
          hasMapRef: !!mapRef.current
        });
      }
    };

    // Only initialize when Google Maps is loaded via the wrapper
    if (isGoogleMapsLoaded && showMap) {
      // Small delay to ensure map container is rendered
      const timer = setTimeout(initializeGoogleMaps, 100);
      return () => clearTimeout(timer);
    }
  }, [isGoogleMapsLoaded, showMap, currentLocation?.lat, currentLocation?.lng]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setCurrentLocation(pos);
          
          if (map && marker) {
            map.setCenter(pos);
            map.setZoom(15);
            marker.setPosition(pos);
            marker.setAnimation(window.google.maps.Animation.BOUNCE);
            
            setTimeout(() => {
              marker.setAnimation(null);
            }, 1400);
            
            // Reverse geocoding
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: pos }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const address = results[0].formatted_address;
                if (inputRef.current) {
                  inputRef.current.value = address;
                }
                onLocationSelect(address, pos);
              }
            });
          }
        },
        (error) => {
          // Handle geolocation errors with meaningful messages
          let errorMessage = 'Unknown geolocation error';
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = 'Location access denied by user';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = 'Location information unavailable';
          } else if (error.code === error.TIMEOUT) {
            errorMessage = 'Location request timeout';
          }
          console.warn('Geolocation error:', errorMessage, error);
        }
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <Search className="w-4 h-4 text-slate-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          onChange={(e) => {
            onLocationSelect(e.target.value);
            if (!showMap && e.target.value.length > 2) {
              setShowMap(true);
            }
          }}
          onFocus={() => setShowMap(true)}
          placeholder={placeholder || "Search for your business location..."}
          className="w-full pl-10 pr-4 py-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
          autoComplete="off"
        />
        {!isGoogleMapsLoaded && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Current Location Button */}
      <button
        type="button"
        onClick={getCurrentLocation}
        className="w-full p-3 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
      >
        <Navigation className="w-4 h-4" />
        <span>Use my current location</span>
      </button>

      {/* Map Container */}
      {showMap && (
        <>
          {!isGoogleMapsLoaded && !loadError && (
            <div className="rounded-xl border border-slate-600/40 bg-slate-800/20 p-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading Google Maps...</p>
            </div>
          )}

          {loadError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center">
              <p className="text-red-400">Failed to load Google Maps: {loadError}</p>
              <p className="text-slate-400 text-sm mt-2">Please check your internet connection and API key.</p>
            </div>
          )}

          {isGoogleMapsLoaded && !loadError && (
            <div className="rounded-xl overflow-hidden border border-slate-600/40 bg-slate-800/20">
              <div className="bg-slate-700/30 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-300">Select your location on the map</span>
                </div>
                <button
                  onClick={() => setShowMap(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div
                ref={mapRef}
                className="w-full h-64"
                style={{ minHeight: '256px' }}
              />
              <div className="bg-slate-700/20 px-4 py-2">
                <p className="text-xs text-slate-400">
                  Click on the map or drag the marker to select your exact location
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}