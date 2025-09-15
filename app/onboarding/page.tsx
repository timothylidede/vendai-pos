'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoogleMapsWrapper } from '@/components/ui/google-maps-wrapper';
import { LocationPicker } from '@/components/ui/location-picker';
import { Store, Truck, MapPin, Building, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

type UserRole = 'retailer' | 'distributor' | null;

interface OnboardingData {
  role: UserRole;
  businessName: string;
  location: string;
  coordinates?: { lat: number; lng: number };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    role: null,
    businessName: '',
    location: '',
    coordinates: undefined
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Move to optional setup or completion
      router.push('/onboarding/setup');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push('/');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.role !== null;
      case 2:
        return data.businessName.trim() !== '';
      case 3:
        return data.location.trim() !== '';
      default:
        return false;
    }
  };

  return (
    <GoogleMapsWrapper apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>Step {currentStep} of {totalSteps}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <div className="w-full bg-slate-800/40 rounded-full h-2">
                <motion.div
                  className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Onboarding Card */}
            <Card className="backdrop-blur-xl bg-slate-900/80 border border-slate-600/50 rounded-2xl p-8 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700/10 via-transparent to-slate-800/20 pointer-events-none"></div>
            
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {/* Step 1: Role Selection */}
                {currentStep === 1 && (
                  <motion.div
                    key="role-selection"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <h2 className="text-xl font-semibold text-white mb-2">What type of business are you?</h2>
                      <p className="text-slate-400 text-sm">This helps us customize your experience</p>
                    </div>

                    <div className="space-y-4">
                      <button
                        onClick={() => setData({ ...data, role: 'retailer' })}
                        className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                          data.role === 'retailer'
                            ? 'bg-blue-500/20 border-blue-400/50 text-white'
                            : 'bg-slate-800/20 border-slate-600/40 text-slate-300 hover:bg-slate-700/20'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            data.role === 'retailer' ? 'bg-blue-500/30' : 'bg-slate-700/30'
                          }`}>
                            <Store className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-medium">Retailer</div>
                            <div className="text-sm text-slate-400">I sell products to customers</div>
                          </div>
                          {data.role === 'retailer' && (
                            <CheckCircle className="w-5 h-5 text-blue-400 ml-auto" />
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => setData({ ...data, role: 'distributor' })}
                        className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                          data.role === 'distributor'
                            ? 'bg-purple-500/20 border-purple-400/50 text-white'
                            : 'bg-slate-800/20 border-slate-600/40 text-slate-300 hover:bg-slate-700/20'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            data.role === 'distributor' ? 'bg-purple-500/30' : 'bg-slate-700/30'
                          }`}>
                            <Truck className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-medium">Distributor</div>
                            <div className="text-sm text-slate-400">I supply products to retailers</div>
                          </div>
                          {data.role === 'distributor' && (
                            <CheckCircle className="w-5 h-5 text-purple-400 ml-auto" />
                          )}
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Business Name */}
                {currentStep === 2 && (
                  <motion.div
                    key="business-name"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <h2 className="text-xl font-semibold text-white mb-2">What's your business name?</h2>
                      <p className="text-slate-400 text-sm">
                        {data.role === 'retailer' ? 'Your shop or store name' : 'Your company or business name'}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-700/30 flex items-center justify-center">
                          <Building className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="text-sm text-slate-300">
                          {data.role === 'retailer' ? 'Retailer' : 'Distributor'}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={data.businessName}
                        onChange={(e) => setData({ ...data, businessName: e.target.value })}
                        placeholder={data.role === 'retailer' ? 'e.g. Mambo Grocers' : 'e.g. Fresh Foods Distribution'}
                        className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
                        autoFocus
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Location */}
                {currentStep === 3 && (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <h2 className="text-xl font-semibold text-white mb-2">Where is your business located?</h2>
                      <p className="text-slate-400 text-sm">
                        {data.role === 'retailer' ? 'Your shop location' : 'Your main business address'}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-700/30 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="text-sm text-slate-300">{data.businessName}</div>
                      </div>

                      <LocationPicker
                        value={data.location}
                        onLocationSelect={(location, coordinates) => 
                          setData({ ...data, location, coordinates })
                        }
                        placeholder={data.role === 'retailer' ? 'e.g. Nairobi, Kenya' : 'e.g. Nairobi, Kenya'}
                      />

                      <button 
                        className="w-full mt-3 p-3 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((position) => {
                              // You would typically reverse geocode these coordinates to get an address
                              const { latitude, longitude } = position.coords;
                              setData({ 
                                ...data, 
                                location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                                coordinates: { lat: latitude, lng: longitude }
                              });
                            });
                          }
                        }}
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Use my current location</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700/70 text-slate-300 border border-slate-500/60 hover:border-slate-400/80 rounded-xl transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                    canProceed()
                      ? 'bg-white hover:bg-gray-100 text-black shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                      : 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {currentStep === totalSteps ? 'Continue Setup' : 'Next Step'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Skip Option */}
          <div className="text-center mt-6">
            <Button
              onClick={() => router.push('/modules')}
              variant="ghost"
              className="bg-white/90 hover:bg-white text-black font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
            >
              Skip setup and go to dashboard →
            </Button>
          </div>
        </motion.div>
      </div>
      </div>
    </GoogleMapsWrapper>
  );
}