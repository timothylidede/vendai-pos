'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, Package, Users, Truck, Upload, 
  Camera, FileText, Plus, ArrowRight, ArrowLeft, 
  CheckCircle, X, MapPin 
} from 'lucide-react';
import Image from 'next/image';

interface SetupData {
  role: string;
  businessName: string;
  location: string;
  posProducts?: any[];
  inventory?: any[];
  suppliers?: any[];
  deliveryMethods?: any[];
  retailerInvites?: any[];
}

export default function OnboardingSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({
    role: 'retailer', // Will be passed from previous step
    businessName: 'Sample Business',
    location: 'Nairobi, Kenya'
  });

  // Get user role to determine setup flow
  const isRetailer = setupData.role === 'retailer';
  const totalSteps = isRetailer ? 3 : 3; // POS, Inventory, Suppliers vs Inventory, Retailers, Logistics

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push('/onboarding/complete');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/complete');
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push('/onboarding');
    }
  };

  const renderRetailerSetup = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="pos-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                <ShoppingCart className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Set up your POS</h2>
              <p className="text-slate-400 text-sm">Add products to start selling immediately</p>
            </div>

            <div className="space-y-4">
              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Plus className="w-6 h-6 text-blue-400" />
                  <div>
                    <div className="font-medium text-white">Add Products Manually</div>
                    <div className="text-sm text-slate-400">Enter product details one by one</div>
                  </div>
                </div>
              </Button>

              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Upload className="w-6 h-6 text-purple-400" />
                  <div>
                    <div className="font-medium text-white">Upload CSV File</div>
                    <div className="text-sm text-slate-400">Import from spreadsheet</div>
                  </div>
                </div>
              </Button>

              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Camera className="w-6 h-6 text-orange-400" />
                  <div>
                    <div className="font-medium text-white">Photo of Stock List</div>
                    <div className="text-sm text-slate-400">AI will parse your product list</div>
                  </div>
                </div>
              </Button>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="inventory-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Import Your Inventory</h2>
              <p className="text-slate-400 text-sm">Track your stock levels automatically</p>
            </div>

            <div className="space-y-4">
              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <FileText className="w-6 h-6 text-green-400" />
                  <div>
                    <div className="font-medium text-white">Upload Stock List</div>
                    <div className="text-sm text-slate-400">CSV or Excel file</div>
                  </div>
                </div>
              </Button>

              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Plus className="w-6 h-6 text-blue-400" />
                  <div>
                    <div className="font-medium text-white">Manual Entry</div>
                    <div className="text-sm text-slate-400">Add items one by one</div>
                  </div>
                </div>
              </Button>

              <div className="p-4 bg-slate-800/20 border border-slate-600/40 rounded-xl">
                <div className="text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Current Stock: 0 items</div>
                  <div className="text-xs text-slate-500 mt-1">Add inventory to track sales and reorders</div>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="suppliers-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
                <Truck className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Connect with Suppliers</h2>
              <p className="text-slate-400 text-sm">Find distributors near you for easy restocking</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Sam West Distributors</div>
                    <div className="text-sm text-green-400">2.3 km away</div>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-3">Fresh produce, dairy, household items</p>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  Connect
                </Button>
              </div>

              <div className="p-4 bg-slate-800/20 border border-slate-600/40 rounded-xl">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Mahitaji Suppliers</div>
                    <div className="text-sm text-slate-400">4.7 km away</div>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-3">Beverages, snacks, personal care</p>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                  Connect
                </Button>
              </div>

              <Button className="w-full p-3 bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-slate-300">
                <Plus className="w-4 h-4 mr-2" />
                Find More Suppliers
              </Button>
            </div>
          </motion.div>
        );
    }
  };

  const renderDistributorSetup = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="catalog-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Upload Your Catalog</h2>
              <p className="text-slate-400 text-sm">Let retailers browse your products</p>
            </div>

            <div className="space-y-4">
              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Upload className="w-6 h-6 text-blue-400" />
                  <div>
                    <div className="font-medium text-white">Upload Product Catalog</div>
                    <div className="text-sm text-slate-400">CSV, Excel, or price list</div>
                  </div>
                </div>
              </Button>

              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Camera className="w-6 h-6 text-orange-400" />
                  <div>
                    <div className="font-medium text-white">Photo of Price List</div>
                    <div className="text-sm text-slate-400">AI will extract products and prices</div>
                  </div>
                </div>
              </Button>

              <Button className="w-full p-4 h-auto bg-slate-800/20 hover:bg-slate-700/30 border border-slate-600/40 hover:border-slate-500/60 text-left">
                <div className="flex items-center space-x-4">
                  <Plus className="w-6 h-6 text-purple-400" />
                  <div>
                    <div className="font-medium text-white">Add Products Manually</div>
                    <div className="text-sm text-slate-400">Enter product details manually</div>
                  </div>
                </div>
              </Button>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="retailers-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Invite Retailers</h2>
              <p className="text-slate-400 text-sm">Connect with your existing customers</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Phone Numbers (comma separated)</label>
                <textarea
                  placeholder="e.g. +254700123456, +254711234567"
                  rows={3}
                  className="w-full p-3 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Email Addresses (comma separated)</label>
                <textarea
                  placeholder="e.g. shop1@example.com, retailer2@gmail.com"
                  rows={3}
                  className="w-full p-3 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200 resize-none"
                />
              </div>

              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                Send Invitations
              </Button>

              <div className="text-center">
                <p className="text-sm text-slate-400">
                  Don't have retailer contacts? <br />
                  <span className="text-blue-400 hover:text-blue-300 cursor-pointer">Find retailers near you →</span>
                </p>
              </div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="logistics-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                <Truck className="w-6 h-6 text-orange-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Delivery Methods</h2>
              <p className="text-slate-400 text-sm">How will you deliver to retailers?</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-800/20 border border-slate-600/40 rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <div>
                    <div className="font-medium text-white">🚚 Self Delivery</div>
                    <div className="text-sm text-slate-400">Use your own vehicles</div>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-slate-800/20 border border-slate-600/40 rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <div>
                    <div className="font-medium text-white">📦 Third-Party Logistics</div>
                    <div className="text-sm text-slate-400">Partner with delivery companies</div>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-slate-800/20 border border-slate-600/40 rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <div>
                    <div className="font-medium text-white">🏍️ Rider Network</div>
                    <div className="text-sm text-slate-400">Use motorcycle delivery riders</div>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-slate-800/20 border border-slate-600/40 rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <div>
                    <div className="font-medium text-white">🏪 Retailer Pickup</div>
                    <div className="text-sm text-slate-400">Retailers collect from your location</div>
                  </div>
                </label>
              </div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-slate-600/20 backdrop-blur-sm border border-blue-400/20 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-4">
              <Image
                src="/images/logo-icon-remove.png"
                alt="VendAI Logo"
                width={40}
                height={40}
                className="w-8 h-8 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Optional Setup</h1>
            <p className="text-slate-400 text-sm">
              {isRetailer ? 'Set up your retail operations' : 'Configure your distribution business'}
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Setup {currentStep} of {totalSteps}</span>
              <span>You can skip any step</span>
            </div>
            <div className="w-full bg-slate-800/40 rounded-full h-2">
              <motion.div
                className="h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Setup Card */}
          <Card className="backdrop-blur-xl bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/70 border border-slate-700/40 rounded-2xl p-8 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.6)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-transparent to-slate-900/30 pointer-events-none"></div>
            
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {isRetailer ? renderRetailerSetup() : renderDistributorSetup()}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="px-6 py-3 bg-slate-800/20 hover:bg-slate-700/30 text-slate-300 border border-slate-600/40 hover:border-slate-500/60 rounded-xl transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <div className="flex space-x-3">
                  <Button
                    onClick={handleSkip}
                    variant="outline"
                    className="px-6 py-3 bg-slate-800/20 hover:bg-slate-700/30 text-slate-400 border border-slate-600/40 hover:border-slate-500/60 rounded-xl transition-all duration-200"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Skip
                  </Button>

                  <Button
                    onClick={handleNext}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    {currentStep === totalSteps ? 'Finish Setup' : 'Next'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Skip All Option */}
          <div className="text-center mt-6">
            <button
              onClick={() => router.push('/onboarding/complete')}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors duration-200"
            >
              Skip all setup and go to dashboard →
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}