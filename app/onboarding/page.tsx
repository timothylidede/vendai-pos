'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoogleMapsWrapper } from '@/components/ui/google-maps-wrapper';
import { LocationPickerWithMap } from '@/components/ui/location-picker-with-map';
import { Store, Truck, MapPin, Building, CheckCircle, ArrowRight, ArrowLeft, Phone, Sparkles, Users, Mail } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getInvitation, acceptInvitation } from '@/lib/invitation-operations';
import { notifyInvitationAccepted, notifyMemberJoined } from '@/lib/notification-operations';

type UserRole = 'retailer' | 'distributor' | null;

interface OnboardingData {
  role: UserRole;
  organizationName: string;
  contactNumber: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  invitationId?: string;
  isJoiningExisting?: boolean;
  inviterName?: string;
  inviterOrganization?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    role: null,
    organizationName: '',
    contactNumber: '',
    location: '',
    coordinates: undefined,
    invitationId: undefined,
    isJoiningExisting: false,
    inviterName: '',
    inviterOrganization: ''
  });

  const totalSteps = data.isJoiningExisting ? 1 : 2; // Fewer steps if joining existing organization
  const progress = (currentStep / totalSteps) * 100;

  // Listen for auth state changes and check invitation/onboarding status
  useEffect(() => {
    const checkInvitation = async () => {
      // Check for invitation ID in URL params
      const urlParams = new URLSearchParams(window.location.search);
      const invitationId = urlParams.get('invite');
      
      if (invitationId) {
        try {
          // Use the invitation operations utility
          const result = await getInvitation(invitationId);
          if (result.success && result.invitation) {
            const invitation = result.invitation;
            setData(prev => ({
              ...prev,
              invitationId,
              isJoiningExisting: true,
              inviterName: invitation.inviterName,
              inviterOrganization: invitation.organizationName,
              role: invitation.role,
              organizationName: invitation.organizationName,
              location: invitation.organizationLocation || '',
              coordinates: invitation.organizationCoordinates
            }));
            setCurrentStep(1);
          } else {
            console.error('Invalid invitation:', result.error);
            // Invalid invitation, proceed with normal flow
            setData(prev => ({ ...prev, isJoiningExisting: false }));
          }
        } catch (error) {
          console.error('Error checking invitation:', error);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists() && userDoc.data().onboardingCompleted) {
            // User has already completed onboarding, redirect to modules
            console.log('User has already completed onboarding, redirecting from onboarding to modules');
            router.push('/modules');
            return;
          }
          
          // Check for invitations after setting user
          await checkInvitation();
          setUser(user);
          setLoading(false);
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          setLoading(false);
        }
      } else {
        router.push('/signup');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleCompleteOnboarding();
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!user) {
      console.error('No user logged in');
      router.push('/signup');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (data.isJoiningExisting && data.invitationId) {
        // Accept invitation and join existing organization
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          role: data.role,
          organizationName: data.organizationName,
          contactNumber: data.contactNumber,
          location: data.location,
          coordinates: data.coordinates,
          onboardingCompleted: true,
          isOrganizationCreator: false,
          joinedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Mark invitation as accepted
        const acceptResult = await acceptInvitation(data.invitationId, user.uid);
        if (!acceptResult.success) {
          console.error('Failed to accept invitation:', acceptResult.error);
        }

        // Send notifications
        try {
          // Get invitation details for notifications
          const invitationResult = await getInvitation(data.invitationId);
          if (invitationResult.success && invitationResult.invitation) {
            const invitation = invitationResult.invitation;
            
            // Notify the inviter that their invitation was accepted
            await notifyInvitationAccepted(
              invitation.inviterUid,
              user.displayName || user.email?.split('@')[0] || 'New Member',
              user.email || '',
              data.organizationName
            );

            // Notify all organization members about the new member
            await notifyMemberJoined(
              data.organizationName,
              user.displayName || user.email?.split('@')[0] || 'New Member',
              user.email || '',
              user.uid
            );
          }
        } catch (error) {
          console.error('Error sending notifications:', error);
          // Don't fail the onboarding process if notifications fail
        }

        console.log('Invitation accepted and user joined organization');
      } else {
        // Create new organization
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          role: data.role,
          organizationName: data.organizationName,
          contactNumber: data.contactNumber,
          location: data.location,
          coordinates: data.coordinates,
          onboardingCompleted: true,
          isOrganizationCreator: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('New organization created');
      }
      
      router.push('/modules');
    } catch (error) {
      console.error('Error saving user data:', error);
      router.push('/modules');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
    // Remove the ability to go back to home page - users must complete onboarding
  };

  const canProceed = () => {
    if (data.isJoiningExisting) {
      // Only need contact number for invited users
      return data.contactNumber.trim() !== '';
    } else {
      switch (currentStep) {
        case 1:
          return data.role !== null;
        case 2:
          return data.organizationName.trim() !== '' && 
                 data.contactNumber.trim() !== '' && 
                 data.location.trim() !== '';
        default:
          return false;
      }
    }
  };

  return (
    <GoogleMapsWrapper apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 p-2 rounded text-xs">
          Google Maps API Key Missing
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      )}

      {/* Main onboarding flow */}
      {!loading && user && (
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
                  <span>{data.isJoiningExisting ? 'Accepting Invitation' : `Step ${currentStep} of ${totalSteps}`}</span>
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
                    {/* Invitation Acceptance Screen */}
                    {data.isJoiningExisting && (
                      <motion.div
                        key="invitation-acceptance"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-400/30 flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-blue-400" />
                          </div>
                          <h2 className="text-xl font-semibold text-white mb-2">You've been invited!</h2>
                          <p className="text-slate-400 text-sm">
                            {data.inviterName} has invited you to join {data.inviterOrganization}
                          </p>
                        </div>

                        <div className="bg-slate-800/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-400">Organization</span>
                            <span className="text-sm text-white font-medium">{data.inviterOrganization}</span>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-400">Role</span>
                            <span className="text-sm text-white font-medium capitalize">{data.role}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Invited by</span>
                            <span className="text-sm text-white font-medium">{data.inviterName}</span>
                          </div>
                        </div>

                        {/* Contact Number for invited users */}
                        <div>
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                              <Phone className="w-4 h-4 text-slate-400" />
                            </div>
                            <label className="text-sm text-slate-300 font-medium">Your Contact Number</label>
                          </div>
                          <input
                            type="tel"
                            value={data.contactNumber}
                            onChange={(e) => setData({ ...data, contactNumber: e.target.value })}
                            placeholder="e.g. +254 700 000 000"
                            className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
                            autoFocus
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 1: Role Selection (only for new organizations) */}
                    {!data.isJoiningExisting && currentStep === 1 && (
                      <motion.div
                        key="role-selection"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <h2 className="text-xl font-semibold text-white mb-2">What type of organization are you creating?</h2>
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
                                <div className="font-medium">Retail Organization</div>
                                <div className="text-sm text-slate-400">Sell products to customers</div>
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
                                <div className="font-medium">Distribution Organization</div>
                                <div className="text-sm text-slate-400">Supply products to retailers</div>
                              </div>
                              {data.role === 'distributor' && (
                                <CheckCircle className="w-5 h-5 text-purple-400 ml-auto" />
                              )}
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Organization Details & Location (only for new organizations) */}
                    {!data.isJoiningExisting && currentStep === 2 && (
                      <motion.div
                        key="organization-details"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <h2 className="text-xl font-semibold text-white mb-2">Tell us about your organization</h2>
                          <p className="text-slate-400 text-sm">
                            {data.role === 'retailer' ? 'Your retail organization details' : 'Your distribution organization details'}
                          </p>
                        </div>

                        <div className="space-y-6">
                          {/* Organization Name */}
                          <div>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                                <Building className="w-4 h-4 text-slate-400" />
                              </div>
                              <label className="text-sm text-slate-300 font-medium">Organization Name</label>
                            </div>
                            <input
                              type="text"
                              value={data.organizationName}
                              onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                              placeholder={data.role === 'retailer' ? 'e.g. Mambo Retail Group' : 'e.g. Fresh Foods Distribution'}
                              className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
                              autoFocus
                            />
                          </div>

                          {/* Contact Number */}
                          <div>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                                <Phone className="w-4 h-4 text-slate-400" />
                              </div>
                              <label className="text-sm text-slate-300 font-medium">Contact Number</label>
                            </div>
                            <input
                              type="tel"
                              value={data.contactNumber}
                              onChange={(e) => setData({ ...data, contactNumber: e.target.value })}
                              placeholder="e.g. +254 700 000 000"
                              className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
                            />
                          </div>

                          {/* Location */}
                          <div>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-slate-400" />
                              </div>
                              <label className="text-sm text-slate-300 font-medium">Organization Location</label>
                            </div>
                            <LocationPickerWithMap
                              value={data.location}
                              onLocationSelect={(location, coordinates) => 
                                setData({ ...data, location, coordinates })
                              }
                              placeholder={data.role === 'retailer' ? 'Search for your main location...' : 'Search for your distribution center...'}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between mt-8">
                    {(!data.isJoiningExisting && currentStep > 1) ? (
                      <Button
                        onClick={handleBack}
                        variant="outline"
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700/70 text-slate-300 border border-slate-500/60 hover:border-slate-400/80 rounded-xl transition-all duration-200"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    ) : (
                      <div></div> 
                    )}

                    <Button
                      onClick={handleNext}
                      disabled={!canProceed() || isSubmitting}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center ${
                        canProceed() && !isSubmitting
                          ? 'bg-white hover:bg-gray-100 text-black shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                          : 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                          {data.isJoiningExisting ? 'Joining...' : 'Setting up...'}
                        </>
                      ) : (
                        <>
                          {(data.isJoiningExisting || currentStep === totalSteps) ? (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              {data.isJoiningExisting ? 'Join Organization' : 'Create Organization'}
                            </>
                          ) : (
                            <>
                              Next Step
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </GoogleMapsWrapper>
  );
}