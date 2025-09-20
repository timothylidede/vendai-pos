'use client';

import { useState } from 'react';
import { MapPin, Check } from 'lucide-react';

interface SimpleLocationPickerProps {
  onLocationSelect: (location: string, coordinates?: { lat: number; lng: number }) => void;
  value: string;
  placeholder?: string;
}

const kenyanCities = [
  { name: 'Nairobi', coordinates: { lat: -1.2921, lng: 36.8219 } },
  { name: 'Mombasa', coordinates: { lat: -4.0435, lng: 39.6682 } },
  { name: 'Nakuru', coordinates: { lat: -0.3031, lng: 36.0800 } },
  { name: 'Eldoret', coordinates: { lat: 0.5143, lng: 35.2698 } },
  { name: 'Kisumu', coordinates: { lat: -0.0917, lng: 34.7680 } },
  { name: 'Thika', coordinates: { lat: -1.0332, lng: 37.0692 } },
  { name: 'Malindi', coordinates: { lat: -3.2194, lng: 40.1169 } },
  { name: 'Kitale', coordinates: { lat: 1.0157, lng: 35.0062 } },
  { name: 'Garissa', coordinates: { lat: -0.4536, lng: 39.6401 } },
  { name: 'Kakamega', coordinates: { lat: 0.2827, lng: 34.7519 } },
  { name: 'Machakos', coordinates: { lat: -1.5177, lng: 37.2634 } },
  { name: 'Meru', coordinates: { lat: 0.0469, lng: 37.6553 } },
  { name: 'Nyeri', coordinates: { lat: -0.4209, lng: 36.9483 } },
  { name: 'Kericho', coordinates: { lat: -0.3676, lng: 35.2861 } },
  { name: 'Embu', coordinates: { lat: -0.5396, lng: 37.4513 } }
];

export function SimpleLocationPicker({ onLocationSelect, value, placeholder = "Select your location" }: SimpleLocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);

  const filteredCities = kenyanCities.filter(city =>
    city.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCitySelect = (city: typeof kenyanCities[0]) => {
    setSearchTerm(city.name);
    onLocationSelect(city.name, city.coordinates);
    setIsOpen(false);
  };

  const handleCustomLocation = () => {
    if (searchTerm && !kenyanCities.find(city => city.name.toLowerCase() === searchTerm.toLowerCase())) {
      onLocationSelect(searchTerm);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200 pr-10"
        />
        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600/40 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filteredCities.length > 0 && (
            <div className="p-2">
              <div className="text-xs text-slate-400 px-2 py-1 font-medium">Popular Cities</div>
              {filteredCities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-white text-sm">{city.name}</span>
                  </div>
                  {value === city.name && <Check className="w-3 h-3 text-blue-400" />}
                </button>
              ))}
            </div>
          )}
          
          {searchTerm && !kenyanCities.find(city => city.name.toLowerCase() === searchTerm.toLowerCase()) && (
            <div className="p-2 border-t border-slate-600/40">
              <button
                onClick={handleCustomLocation}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-colors duration-200"
              >
                <MapPin className="w-3 h-3 text-slate-400" />
                <span className="text-white text-sm">Use "{searchTerm}"</span>
              </button>
            </div>
          )}
          
          <div className="p-2 border-t border-slate-600/40">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center px-3 py-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}