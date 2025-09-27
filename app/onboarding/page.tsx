'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Removed SimpleLocationPicker in favor of full map picker
// import { SimpleLocationPicker } from '@/components/ui/simple-location-picker';
import { GoogleMapsWrapper } from '@/components/ui/google-maps-wrapper';
import { LocationPickerWithMap } from '@/components/ui/location-picker-with-map';
import { Store, Truck, MapPin, Building, CheckCircle, ArrowRight, ArrowLeft, Phone, Sparkles, Users, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getInvitation, acceptInvitation } from '@/lib/invitation-operations';
import { createOrgScaffold, ensureUniqueOrgId } from '@/lib/org-operations';
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
  const [error, setError] = useState<string | null>(null);
  // Switch to 0-based step index for Typeform-style flow
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
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

  // When joining existing org, show a single confirm/contact screen
  const totalSteps = data.isJoiningExisting ? 1 : 4;
  const progress = ((Math.min(currentStep, totalSteps - 1) + 1) / totalSteps) * 100;

  // Slide variants for left-right animation
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 })
  } as const;

  // Listen for auth state changes and check invitation/onboarding status
  useEffect(() => {
    const checkInvitation = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const invitationId = urlParams.get('invite');
      if (invitationId) {
        try {
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
            setCurrentStep(0);
          } else {
            console.error('Invalid invitation:', result.error);
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
          if (userDoc.exists() && (userDoc.data() as any).onboardingCompleted) {
            router.push('/modules');
            return;
          }
          await checkInvitation();
          setUser(user);
          setLoading(false);
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleNext = async () => {
    setError(null);
    if (data.isJoiningExisting) {
      // Single screen for invited users
      await handleCompleteOnboarding();
      return;
    }
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep(s => s + 1);
    } else {
      await handleCompleteOnboarding();
    }
  };

  const handleBack = () => {
    if (data.isJoiningExisting) return; // no back for invited one-screen
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(s => s - 1);
    } else {
      // At first step, go back to chooser
      router.push('/onboarding/choose');
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!user) {
      setError('Authentication error. Please try signing in again.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (data.isJoiningExisting && data.invitationId) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
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

        // Ensure org scaffold exists (safe if already created by org creator)
        try {
          await createOrgScaffold(data.organizationName, {
            creatorUid: user.uid,
            creatorEmail: user.email || null,
          })
        } catch (e) {
          console.warn('Org scaffold ensure failed:', e)
        }

        try {
          const acceptResult = await acceptInvitation(data.invitationId, user.uid);
          if (!acceptResult.success) {
            console.error('Failed to accept invitation:', acceptResult.error);
          }
        } catch (inviteError) {
          console.error('Error accepting invitation:', inviteError);
        }

        try {
          const invitationResult = await getInvitation(data.invitationId);
          if (invitationResult.success && invitationResult.invitation) {
            const invitation = invitationResult.invitation;
            await Promise.all([
              notifyInvitationAccepted(
                invitation.inviterUid,
                user.displayName || user.email?.split('@')[0] || 'New Member',
                user.email || '',
                data.organizationName
              ),
              notifyMemberJoined(
                data.organizationName,
                user.displayName || user.email?.split('@')[0] || 'New Member',
                user.email || '',
                user.uid
              )
            ]);
          }
        } catch (notificationError) {
          console.error('Error sending notifications:', notificationError);
        }
      } else {
        const userDocRef = doc(db, 'users', user.uid);
        // Generate a unique, slugified organization id
        const { orgId, displayName } = await ensureUniqueOrgId(data.organizationName)
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          role: data.role,
          organizationName: orgId,
          organizationDisplayName: displayName,
          contactNumber: data.contactNumber,
          location: data.location,
          coordinates: data.coordinates,
          onboardingCompleted: true,
          isOrganizationCreator: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Provision org scaffold to initialize org_settings and keep data empty
        try {
          await createOrgScaffold(orgId, {
            creatorUid: user.uid,
            creatorEmail: user.email || null,
            displayName,
          })
        } catch (e) {
          console.warn('Org scaffold provisioning failed:', e)
        }
      }
      router.push('/modules');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateContactNumber = (number: string) => number.replace(/\D/g, '').length >= 9;
  const validateOrganizationName = (name: string) => name.trim().length >= 2 && name.trim().length <= 100;

  const canProceed = () => {
    if (data.isJoiningExisting) {
      return data.contactNumber.trim() !== '' && validateContactNumber(data.contactNumber);
    }
    switch (currentStep) {
      case 0:
        return data.role !== null;
      case 1:
        return validateOrganizationName(data.organizationName);
      case 2:
        return data.contactNumber.trim() !== '' && validateContactNumber(data.contactNumber);
      case 3:
        return data.location.trim() !== '' && !!data.coordinates;
      default:
        return false;
    }
  };

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900">
      {/* Loading state */}
      {loading && (
        <div className="min-h-screen w-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-slate-400">Setting up your workspace...</p>
          </div>
        </div>
      )}

      {/* Main onboarding flow */}
      {!loading && user && (
        <div className="min-h-screen w-full flex items-center justify-center p-6">
          <div className="max-w-lg w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>{data.isJoiningExisting ? 'Accepting Invitation' : `Step ${Math.min(currentStep, totalSteps - 1) + 1} of ${totalSteps}`}</span>
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

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-red-300 text-sm font-medium">Error</p>
                    <p className="text-red-400 text-xs">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Onboarding Card */}
              <Card className="backdrop-blur-xl bg-slate-900/80 border border-slate-600/50 rounded-2xl p-8 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700/10 via-transparent to-slate-800/20 pointer-events-none"></div>
              
                <div className="relative z-10">
                  <AnimatePresence mode="wait" custom={direction}>
                    {/* Invitation screen */}
                    {data.isJoiningExisting && (
                      <motion.div
                        key="invited"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
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
                          <div className="flex items-center justify-between mb-3"><span className="text-sm text-slate-400">Organization</span><span className="text-sm text-white font-medium">{data.inviterOrganization}</span></div>
                          <div className="flex items-center justify-between mb-3"><span className="text-sm text-slate-400">Role</span><span className="text-sm text-white font-medium capitalize">{data.role}</span></div>
                          <div className="flex items-center justify-between"><span className="text-sm text-slate-400">Invited by</span><span className="text-sm text-white font-medium">{data.inviterName}</span></div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-3"><div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center"><Phone className="w-4 h-4 text-slate-400" /></div><label className="text-sm text-slate-300 font-medium">Your Contact Number</label></div>
                          <input
                            type="tel"
                            value={data.contactNumber}
                            onChange={(e) => setData({ ...data, contactNumber: e.target.value })}
                            placeholder="e.g. +254 700 000 000"
                            className={`w-full p-4 text-sm rounded-xl bg-slate-800/20 border transition-all duration-200 text-white placeholder-slate-500 ${
                              data.contactNumber && !validateContactNumber(data.contactNumber)
                                ? 'border-red-500/50 focus:border-red-500/70 focus:ring-1 focus:ring-red-500/25'
                                : 'border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25'
                            }`}
                          />
                          {data.contactNumber && !validateContactNumber(data.contactNumber) && (
                            <p className="text-red-400 text-xs mt-1">Please enter a valid phone number (at least 9 digits)</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 0: Role */}
                    {!data.isJoiningExisting && currentStep === 0 && (
                      <motion.div
                        key="role"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
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

                    {/* Step 1: Organization Name */}
                    {!data.isJoiningExisting && currentStep === 1 && (
                      <motion.div
                        key="org-name"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <h2 className="text-xl font-semibold text-white mb-2">What’s your organization name?</h2>
                          <p className="text-slate-400 text-sm">We’ll show this in your workspace</p>
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-3"><div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center"><Building className="w-4 h-4 text-slate-400" /></div><label className="text-sm text-slate-300 font-medium">Organization Name</label></div>
                          <input
                            type="text"
                            value={data.organizationName}
                            onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                            placeholder={data.role === 'retailer' ? 'e.g. Mambo Retail Group' : 'e.g. Fresh Foods Distribution'}
                            className={`w-full p-4 text-sm rounded-xl bg-slate-800/20 border transition-all duration-200 text-white placeholder-slate-500 ${
                              data.organizationName && !validateOrganizationName(data.organizationName)
                                ? 'border-red-500/50 focus:border-red-500/70 focus:ring-1 focus:ring-red-500/25'
                                : 'border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25'
                            }`}
                            autoFocus
                          />
                          {data.organizationName && !validateOrganizationName(data.organizationName) && (
                            <p className="text-red-400 text-xs mt-1">Organization name must be at least 2 characters long</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Contact Number */}
                    {!data.isJoiningExisting && currentStep === 2 && (
                      <motion.div
                        key="contact"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <h2 className="text-xl font-semibold text-white mb-2">What’s your contact number?</h2>
                          <p className="text-slate-400 text-sm">We may use this for account verification</p>
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-3"><div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center"><Phone className="w-4 h-4 text-slate-400" /></div><label className="text-sm text-slate-300 font-medium">Contact Number</label></div>
                          <input
                            type="tel"
                            value={data.contactNumber}
                            onChange={(e) => setData({ ...data, contactNumber: e.target.value })}
                            placeholder="e.g. +254 700 000 000"
                            className="w-full p-4 text-sm rounded-xl bg-slate-800/20 border border-slate-600/40 hover:border-slate-500/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-white placeholder-slate-500 transition-all duration-200"
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Location with Map */}
                    {!data.isJoiningExisting && currentStep === 3 && (
                      <motion.div
                        key="location"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <h2 className="text-xl font-semibold text-white mb-2">Where is your business located?</h2>
                          <p className="text-slate-400 text-sm">Search or pick on the map</p>
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-3"><div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center"><MapPin className="w-4 h-4 text-slate-400" /></div><label className="text-sm text-slate-300 font-medium">Organization Location</label></div>
                          <GoogleMapsWrapper apiKey={mapsApiKey}>
                            <LocationPickerWithMap
                              value={data.location}
                              onLocationSelect={(location: string, coordinates?: { lat: number; lng: number }) => setData({ ...data, location, coordinates })}
                              placeholder={data.role === 'retailer' ? 'Search your main location…' : 'Search your distribution center…'}
                            />
                          </GoogleMapsWrapper>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between mt-8">
                    {!data.isJoiningExisting ? (
                      <Button onClick={handleBack} variant="outline" disabled={isSubmitting} className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700/70 text-slate-300 border border-slate-500/60 hover:border-slate-400/80 rounded-xl transition-all duration-200">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    ) : (
                      <div></div>
                    )}

                    <Button onClick={handleNext} disabled={!canProceed() || isSubmitting} className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center ${canProceed() && !isSubmitting ? 'bg-white hover:bg-gray-100 text-black shadow-lg hover:shadow-xl transform hover:scale-[1.02]' : 'bg-slate-700/30 text-slate-500 cursor-not-allowed'}`}>
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                          {data.isJoiningExisting ? 'Joining...' : 'Setting up...'}
                        </>
                      ) : (
                        <>
                          {data.isJoiningExisting || currentStep === totalSteps - 1 ? (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              {data.isJoiningExisting ? 'Join Organization' : 'Create Organization'}
                            </>
                          ) : (
                            <>
                              Next
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
    </div>
  );
}