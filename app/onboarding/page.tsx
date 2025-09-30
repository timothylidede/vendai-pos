'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Removed SimpleLocationPicker in favor of full map picker
// import { SimpleLocationPicker } from '@/components/ui/simple-location-picker';
import { GoogleMapsWrapper } from '@/components/ui/google-maps-wrapper';
import { LocationPickerWithMap } from '@/components/ui/location-picker-with-map';
import { Store, Truck, MapPin, Building, CheckCircle, ArrowRight, ArrowLeft, Phone, Sparkles, Mail, AlertCircle } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getInvitation, acceptInvitation } from '@/lib/invitation-operations';
import { createOrgScaffold, ensureUniqueOrgId } from '@/lib/org-operations';
import { notifyInvitationAccepted, notifyMemberJoined } from '@/lib/notification-operations';
import { UniversalLoading } from '@/components/universal-loading';

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

interface UserProfileDocument {
  uid: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  organizationName: string;
  organizationDisplayName?: string;
  contactNumber: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  onboardingCompleted: boolean;
  isOrganizationCreator: boolean;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
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
          const userData = userDoc.data();
          if (userDoc.exists() && userData?.onboardingCompleted) {
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
    <div className="relative min-h-screen w-full overflow-hidden px-6 py-16 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[140px]" />
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-500/18 blur-[160px]" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[24rem] w-[24rem] rounded-full bg-indigo-500/18 blur-[160px]" />
        <div className="absolute top-1/4 -left-24 h-72 w-72 rounded-full bg-cyan-400/16 blur-[140px]" />
        <div className="absolute bottom-1/3 left-1/3 h-40 w-40 rounded-full bg-blue-400/12 blur-[110px]" />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex min-h-[60vh] w-full items-center justify-center">
          <UniversalLoading type="initializing" message="Setting up your workspace..." />
        </div>
      )}

      {/* Main onboarding flow */}
      {!loading && user && (
        <div className="flex min-h-[70vh] w-full items-center justify-center">
          <div className="relative z-10 w-full max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* Progress Bar */}
              <div className="mb-10">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-slate-200/70">
                  <span>{data.isJoiningExisting ? 'Accepting Invitation' : `Step ${Math.min(currentStep, totalSteps - 1) + 1} of ${totalSteps}`}</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 shadow-[0_0_18px_rgba(56,189,248,0.45)]"
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
                  className="mb-6 flex items-center gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-4 backdrop-blur-lg"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-300" />
                  <div>
                    <p className="text-sm font-semibold text-red-200">Error</p>
                    <p className="text-xs text-red-300/80">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Onboarding Card */}
              <Card className="group relative overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.06] px-8 py-10 shadow-[0_35px_120px_-45px_rgba(12,24,46,0.85)] backdrop-blur-3xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_65%)] opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(196,181,253,0.2),transparent_70%)] opacity-60" />

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
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-300/40 bg-sky-500/15 shadow-[0_18px_36px_-18px_rgba(56,189,248,0.55)]">
                            <Mail className="h-8 w-8 text-sky-200" />
                          </div>
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">You&rsquo;ve been invited!</h2>
                          <p className="text-sm text-slate-300/80">
                            {data.inviterName} has invited you to join {data.inviterOrganization}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/12 bg-white/8 p-5 backdrop-blur-xl">
                          <div className="flex items-center justify-between pb-3">
                            <span className="text-xs uppercase tracking-[0.28em] text-slate-300/70">Organization</span>
                            <span className="text-sm font-semibold text-white">{data.inviterOrganization}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-white/5 py-3">
                            <span className="text-xs uppercase tracking-[0.28em] text-slate-300/70">Role</span>
                            <span className="text-sm font-semibold capitalize text-sky-200">{data.role}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-white/5 pt-3">
                            <span className="text-xs uppercase tracking-[0.28em] text-slate-300/70">Invited by</span>
                            <span className="text-sm font-semibold text-white">{data.inviterName}</span>
                          </div>
                        </div>
                        <div>
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                              <Phone className="h-4 w-4 text-slate-200" />
                            </div>
                            <label className="text-sm font-medium text-slate-200">Your contact number</label>
                          </div>
                          <input
                            type="tel"
                            value={data.contactNumber}
                            onChange={(e) => setData({ ...data, contactNumber: e.target.value })}
                            placeholder="e.g. +254 700 000 000"
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                              data.contactNumber && !validateContactNumber(data.contactNumber)
                                ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                            }`}
                          />
                          {data.contactNumber && !validateContactNumber(data.contactNumber) && (
                            <p className="mt-2 text-xs text-red-300/80">Please enter a valid phone number (at least 9 digits).</p>
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
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">What type of organization are you creating?</h2>
                          <p className="text-sm text-slate-300/80">We&rsquo;ll tailor your workspace defaults to this role.</p>
                        </div>
                        <div className="space-y-4">
                          <button
                            onClick={() => setData({ ...data, role: 'retailer' })}
                            className={`group w-full rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                              data.role === 'retailer'
                                ? 'border-sky-300/60 bg-sky-500/15 text-white shadow-[0_25px_55px_-35px_rgba(56,189,248,0.85)]'
                                : 'border-white/12 bg-white/6 text-slate-200 hover:border-sky-200/40 hover:bg-sky-400/10'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                                data.role === 'retailer'
                                  ? 'border-sky-200/50 bg-sky-500/20 text-sky-100'
                                  : 'border-white/10 bg-white/8 text-slate-200'
                              }`}>
                                <Store className="h-6 w-6" />
                              </div>
                              <div className="flex-1">
                                <div className="text-base font-semibold text-slate-100">Retail / POS</div>
                                <div className="text-sm text-slate-300/80">Serve customers and process in-store sales.</div>
                              </div>
                              {data.role === 'retailer' && (
                                <CheckCircle className="ml-auto h-5 w-5 text-sky-200" />
                              )}
                            </div>
                          </button>
                          <button
                            onClick={() => setData({ ...data, role: 'distributor' })}
                            className={`group w-full rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                              data.role === 'distributor'
                                ? 'border-indigo-300/60 bg-indigo-500/15 text-white shadow-[0_25px_55px_-35px_rgba(99,102,241,0.85)]'
                                : 'border-white/12 bg-white/6 text-slate-200 hover:border-indigo-200/45 hover:bg-indigo-400/10'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                                data.role === 'distributor'
                                  ? 'border-indigo-200/50 bg-indigo-500/20 text-indigo-100'
                                  : 'border-white/10 bg-white/8 text-slate-200'
                              }`}>
                                <Truck className="h-6 w-6" />
                              </div>
                              <div className="flex-1">
                                <div className="text-base font-semibold text-slate-100">Distributor / Supplier</div>
                                <div className="text-sm text-slate-300/80">Manage catalogue, fulfil orders, and deliver.</div>
                              </div>
                              {data.role === 'distributor' && (
                                <CheckCircle className="ml-auto h-5 w-5 text-indigo-200" />
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
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">What&rsquo;s your organization name?</h2>
                          <p className="text-sm text-slate-300/80">We&rsquo;ll surface this name across dashboards and invites.</p>
                        </div>
                        <div>
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                              <Building className="h-4 w-4 text-slate-200" />
                            </div>
                            <label className="text-sm font-medium text-slate-200">Organization name</label>
                          </div>
                          <input
                            type="text"
                            value={data.organizationName}
                            onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                            placeholder={data.role === 'retailer' ? 'e.g. Mambo Retail Group' : 'e.g. Fresh Foods Distribution'}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                              data.organizationName && !validateOrganizationName(data.organizationName)
                                ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                            }`}
                            autoFocus
                          />
                          {data.organizationName && !validateOrganizationName(data.organizationName) && (
                            <p className="mt-2 text-xs text-red-300/80">Organization name must be at least 2 characters long.</p>
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
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">What&rsquo;s your contact number?</h2>
                          <p className="text-sm text-slate-300/80">We may use this for account verification or quick onboarding help.</p>
                        </div>
                        <div>
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                              <Phone className="h-4 w-4 text-slate-200" />
                            </div>
                            <label className="text-sm font-medium text-slate-200">Contact number</label>
                          </div>
                          <input
                            type="tel"
                            value={data.contactNumber}
                            onChange={(e) => setData({ ...data, contactNumber: e.target.value })}
                            placeholder="e.g. +254 700 000 000"
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                              data.contactNumber && !validateContactNumber(data.contactNumber)
                                ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                            }`}
                          />
                          {data.contactNumber && !validateContactNumber(data.contactNumber) && (
                            <p className="mt-2 text-xs text-red-300/80">Please enter a valid phone number (at least 9 digits).</p>
                          )}
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
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">Where is your business located?</h2>
                          <p className="text-sm text-slate-300/80">Search or drop a pin so suppliers and teammates can find you.</p>
                        </div>
                        <div>
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                              <MapPin className="h-4 w-4 text-slate-200" />
                            </div>
                            <label className="text-sm font-medium text-slate-200">Organization location</label>
                          </div>
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
                  <div className="mt-10 flex items-center justify-between">
                    {!data.isJoiningExisting ? (
                      <Button
                        onClick={handleBack}
                        variant="outline"
                        disabled={isSubmitting}
                        className="group flex items-center gap-2 rounded-xl border border-white/12 bg-white/8 px-6 py-3 text-slate-200 transition hover:border-sky-200/40 hover:bg-white/12 disabled:opacity-40"
                      >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                        Back
                      </Button>
                    ) : (
                      <div></div>
                    )}

                    <Button
                      onClick={handleNext}
                      disabled={!canProceed() || isSubmitting}
                      className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 ${
                        canProceed() && !isSubmitting
                          ? 'bg-gradient-to-r from-sky-500/90 via-cyan-400/90 to-indigo-500/90 text-slate-950 shadow-[0_18px_45px_-25px_rgba(56,189,248,0.85)] hover:shadow-[0_25px_55px_-25px_rgba(56,189,248,0.95)]'
                          : 'border border-white/10 bg-white/6 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent"></div>
                          {data.isJoiningExisting ? 'Joining…' : 'Setting up…'}
                        </>
                      ) : (
                        <>
                          {data.isJoiningExisting || currentStep === totalSteps - 1 ? (
                            <>
                              <Sparkles className="h-4 w-4" />
                              {data.isJoiningExisting ? 'Join organization' : 'Create organization'}
                            </>
                          ) : (
                            <>
                              Next
                              <ArrowRight className="h-4 w-4" />
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