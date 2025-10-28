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
import localFont from 'next/font/local';

const neueHaas = localFont({
  src: [
    {
      path: '../../public/fonts/Neue Haas Grotesk Display Pro 55 Roman.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Neue Haas Grotesk Display Pro 65 Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Neue Haas Grotesk Display Pro 75 Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-neue-haas'
});

type UserRole = 'retailer' | 'distributor' | null;

interface OnboardingData {
  role: UserRole;
  organizationName: string;
  contactNumber: string;
  phoneNumber?: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  invitationId?: string;
  isJoiningExisting?: boolean;
  inviterName?: string;
  inviterOrganization?: string;
  // Retailer-specific fields
  salesChannels?: string[];
  salesChannelDescription?: string;
  website?: string;
  county?: string;
  subCounty?: string;
  storeCategory?: string;
  openingYear?: string;
  // Distributor-specific fields
  wholesaleProductCount?: string;
  storeCount?: string;
  primaryCategory?: string;
  hearAboutUs?: string;
  instagramHandle?: string;
  fulfillmentEmail?: string;
  facebookHandle?: string;
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
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    role: null,
    organizationName: '',
    contactNumber: '',
    phoneNumber: '',
    location: '',
    coordinates: undefined,
    invitationId: undefined,
    isJoiningExisting: false,
    inviterName: '',
    inviterOrganization: '',
    salesChannels: [],
    salesChannelDescription: '',
    website: '',
    county: '',
    subCounty: '',
    storeCategory: '',
    openingYear: '',
    wholesaleProductCount: '',
    storeCount: '',
    primaryCategory: '',
    hearAboutUs: '',
    instagramHandle: '',
    fulfillmentEmail: '',
    facebookHandle: ''
  });

  const [showRetailerWarning, setShowRetailerWarning] = useState(false);

  // LocalStorage key for caching onboarding data
  const ONBOARDING_CACHE_KEY = 'vendai_onboarding_cache';

  // Load cached data on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(ONBOARDING_CACHE_KEY);
        if (cached) {
          const { data: cachedData, step: cachedStep } = JSON.parse(cached);
          // Only restore if we haven't started onboarding yet
          if (cachedData && !data.role) {
            setData(cachedData);
            setCurrentStep(cachedStep || 0);
            console.log('Restored onboarding data from cache');
          }
        }
      } catch (error) {
        console.error('Error loading cached onboarding data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && data.role) {
      try {
        const cacheData = {
          data,
          step: currentStep,
          timestamp: Date.now()
        };
        localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify(cacheData));
      } catch (error) {
        console.error('Error saving onboarding data to cache:', error);
      }
    }
  }, [data, currentStep]);

  // Clear cache on successful completion
  const clearOnboardingCache = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(ONBOARDING_CACHE_KEY);
        console.log('Cleared onboarding cache');
      } catch (error) {
        console.error('Error clearing onboarding cache:', error);
      }
    }
  };

  // Store categories for retailer onboarding
  const storeCategories = [
    { id: 'general-trade', label: 'General Trade' },
    { id: 'food-beverage', label: 'Food & Beverage' },
    { id: 'electrical', label: 'Electrical' },
    { id: 'construction', label: 'Construction' },
    { id: 'fmcg', label: 'FMCG' },
    { id: 'cosmetics', label: 'Cosmetics' },
    { id: 'furniture', label: 'Furniture' },
    { id: 'electronics', label: 'Electronics' },
    { id: 'chemical', label: 'Chemical' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'textile', label: 'Textile' },
    { id: 'agricultural', label: 'Agricultural' },
    { id: 'pharmaceutical', label: 'Pharmaceutical' },
    { id: 'stationery', label: 'Stationery' },
    { id: 'automotive', label: 'Automotive' },
    { id: 'plumbing', label: 'Plumbing' },
    { id: 'industrial', label: 'Industrial' },
    { id: 'cleaning', label: 'Cleaning' },
    { id: 'alcohol', label: 'Alcohol' }
  ];

  // Opening year options
  const openingYearOptions = [
    { id: 'opening-soon', label: 'Opening soon' },
    { id: '2025', label: '2025' },
    { id: '2024', label: '2024' },
    { id: '2023', label: '2023' },
    { id: '2022', label: '2022' },
    { id: '2021', label: '2021' },
    { id: '2020', label: '2020' },
    { id: 'before-2020', label: 'Before 2020' }
  ];

  // Kenya counties and sub-counties data
  const kenyanCounties = [
    { code: 30, name: 'Baringo', capital: 'Kabarnet', subCounties: ['Baringo Central', 'Baringo North', 'Baringo South', 'Eldama Ravine', 'Mogotio', 'Tiaty'] },
    { code: 36, name: 'Bomet', capital: 'Bomet', subCounties: ['Bomet Central', 'Bomet East', 'Chepalungu', 'Konoin', 'Sotik'] },
    { code: 39, name: 'Bungoma', capital: 'Bungoma', subCounties: ['Bumula', 'Kabuchai', 'Kanduyi', 'Kimilil', 'Mt Elgon', 'Sirisia', 'Tongaren', 'Webuye East', 'Webuye West'] },
    { code: 40, name: 'Busia', capital: 'Busia', subCounties: ['Budalangi', 'Butula', 'Funyula', 'Nambele', 'Teso North', 'Teso South'] },
    { code: 28, name: 'Elgeyo-Marakwet', capital: 'Iten', subCounties: ['Keiyo North', 'Keiyo South', 'Marakwet East', 'Marakwet West'] },
    { code: 14, name: 'Embu', capital: 'Embu', subCounties: ['Manyatta', 'Mbeere North', 'Mbeere South', 'Runyenjes'] },
    { code: 7, name: 'Garissa', capital: 'Garissa', subCounties: ['Daadab', 'Fafi', 'Garissa Township', 'Hulugho', 'Ijara', 'Lagdera', 'Balambala'] },
    { code: 43, name: 'Homa Bay', capital: 'Homa Bay', subCounties: ['Homabay Town', 'Kabondo', 'Karachwonyo', 'Kasipul', 'Mbita', 'Ndhiwa', 'Rangwe', 'Suba'] },
    { code: 11, name: 'Isiolo', capital: 'Isiolo', subCounties: ['Isiolo', 'Merti', 'Garbatulla'] },
    { code: 34, name: 'Kajiado', capital: 'Kajiado', subCounties: ['Isinya', 'Kajiado Central', 'Kajiado North', 'Loitokitok', 'Mashuuru'] },
    { code: 37, name: 'Kakamega', capital: 'Kakamega', subCounties: ['Butere', 'Kakamega Central', 'Kakamega East', 'Kakamega North', 'Kakamega South', 'Khwisero', 'Lugari', 'Lukuyani', 'Lurambi', 'Matete', 'Mumias', 'Mutungu', 'Navakholo'] },
    { code: 35, name: 'Kericho', capital: 'Kericho', subCounties: ['Ainamoi', 'Belgut', 'Bureti', 'Kipkelion East', 'Kipkelion West', 'Soin/Sigowet'] },
    { code: 22, name: 'Kiambu', capital: 'Kiambu', subCounties: ['Gatundu North', 'Gatundu South', 'Githunguri', 'Juja', 'Kabete', 'Kiambaa', 'Kiambu', 'Kikuyu', 'Limuru', 'Ruiru', 'Thika Town', 'Lari'] },
    { code: 3, name: 'Kilifi', capital: 'Kilifi', subCounties: ['Ganze', 'Kaloleni', 'Kilifi North', 'Kilifi South', 'Magarini', 'Malindi', 'Rabai'] },
    { code: 20, name: 'Kirinyaga', capital: 'Kerugoya/Kutus', subCounties: ['Kirinyaga Central', 'Kirinyaga East', 'Kirinyaga West', 'Mwea East', 'Mwea West'] },
    { code: 45, name: 'Kisii', capital: 'Kisii', subCounties: [] },
    { code: 42, name: 'Kisumu', capital: 'Kisumu', subCounties: ['Kisumu Central', 'Kisumu East', 'Kisumu West', 'Muhoroni', 'Nyakach', 'Nyando', 'Seme'] },
    { code: 15, name: 'Kitui', capital: 'Kitui', subCounties: ['Kitui West', 'Kitui Central', 'Kitui Rural', 'Kitui South', 'Kitui East', 'Mwingi North', 'Mwingi West', 'Mwingi Central'] },
    { code: 2, name: 'Kwale', capital: 'Kwale', subCounties: ['Kinango', 'Lunga Lunga', 'Msambweni', 'Matuga'] },
    { code: 31, name: 'Laikipia', capital: 'Rumuruti', subCounties: ['Laikipia Central', 'Laikipia East', 'Laikipia North', 'Laikipia West', 'Nyahururu'] },
    { code: 5, name: 'Lamu', capital: 'Lamu', subCounties: ['Lamu East', 'Lamu West'] },
    { code: 16, name: 'Machakos', capital: 'Machakos', subCounties: ['Kathiani', 'Machakos Town', 'Masinga', 'Matungulu', 'Mavoko', 'Mwala', 'Yatta'] },
    { code: 17, name: 'Makueni', capital: 'Wote', subCounties: ['Kaiti', 'Kibwezi West', 'Kibwezi East', 'Kilome', 'Makueni', 'Mbooni'] },
    { code: 9, name: 'Mandera', capital: 'Mandera', subCounties: ['Banissa', 'Lafey', 'Mandera East', 'Mandera North', 'Mandera South', 'Mandera West'] },
    { code: 10, name: 'Marsabit', capital: 'Marsabit', subCounties: ['Laisamis', 'Moyale', 'North Hor', 'Saku'] },
    { code: 12, name: 'Meru', capital: 'Meru', subCounties: ['Buuri', 'Igembe Central', 'Igembe North', 'Igembe South', 'Imenti Central', 'Imenti North', 'Imenti South', 'Tigania East', 'Tigania West'] },
    { code: 44, name: 'Migori', capital: 'Migori', subCounties: ['Awendo', 'Kuria East', 'Kuria West', 'Mabera', 'Ntimaru', 'Rongo', 'Suna East', 'Suna West', 'Uriri'] },
    { code: 1, name: 'Mombasa', capital: 'Mombasa City', subCounties: ['Changamwe', 'Jomvu', 'Kisauni', 'Likoni', 'Mvita', 'Nyali'] },
    { code: 21, name: "Murang'a", capital: "Murang'a", subCounties: ['Gatanga', 'Kahuro', 'Kandara', 'Kangema', 'Kigumo', 'Kiharu', 'Mathioya', "Murang'a South"] },
    { code: 47, name: 'Nairobi', capital: 'Nairobi City', subCounties: ['Dagoretti North', 'Dagoretti South', 'Embakasi Central', 'Embakasi East', 'Embakasi North', 'Embakasi South', 'Embakasi West', 'Kamukunji', 'Kasarani', 'Kibra', "Lang'ata", 'Makadara', 'Mathare', 'Roysambu', 'Ruaraka', 'Starehe', 'Westlands'] },
    { code: 32, name: 'Nakuru', capital: 'Nakuru', subCounties: ['Bahati', 'Gilgil', 'Kuresoi North', 'Kuresoi South', 'Molo', 'Naivasha', 'Nakuru Town East', 'Nakuru Town West', 'Njoro', 'Rongai', 'Subukia'] },
    { code: 29, name: 'Nandi', capital: 'Kapsabet', subCounties: ['Aldai', 'Chesumei', 'Emgwen', 'Mosop', 'Nandi Hills', 'Tindiret'] },
    { code: 33, name: 'Narok', capital: 'Narok', subCounties: ['Narok East', 'Narok North', 'Narok South', 'Narok West', 'Transmara East', 'Transmara West'] },
    { code: 46, name: 'Nyamira', capital: 'Nyamira', subCounties: ['Borabu', 'Manga', 'Masaba North', 'Nyamira North', 'Nyamira South'] },
    { code: 18, name: 'Nyandarua', capital: 'Ol Kalou', subCounties: ['Kinangop', 'Kipipiri', 'Ndaragwa', 'Ol-Kalou', 'Ol Joro Orok'] },
    { code: 19, name: 'Nyeri', capital: 'Nyeri', subCounties: ['Kieni East', 'Kieni West', 'Mathira East', 'Mathira West', 'Mukurweini', 'Nyeri Town', 'Othaya', 'Tetu'] },
    { code: 25, name: 'Samburu', capital: 'Maralal', subCounties: ['Samburu East', 'Samburu North', 'Samburu West'] },
    { code: 41, name: 'Siaya', capital: 'Siaya', subCounties: ['Alego Usonga', 'Bondo', 'Gem', 'Rarieda', 'Ugenya', 'Unguja'] },
    { code: 6, name: 'Taita-Taveta', capital: 'Voi', subCounties: ['Mwatate', 'Taveta', 'Voi', 'Wundanyi'] },
    { code: 4, name: 'Tana River', capital: 'Hola', subCounties: ['Bura', 'Galole', 'Garsen'] },
    { code: 13, name: 'Tharaka-Nithi', capital: 'Chuka', subCounties: ['Tharaka North', 'Tharaka South', 'Chuka', "Igambango'mbe", 'Maara', 'Chiakariga and Muthambi'] },
    { code: 26, name: 'Trans-Nzoia', capital: 'Kitale', subCounties: ['Cherangany', 'Endebess', 'Kiminini', 'Kwanza', 'Saboti'] },
    { code: 23, name: 'Turkana', capital: 'Lodwar', subCounties: ['Loima', 'Turkana Central', 'Turkana East', 'Turkana North', 'Turkana South'] },
    { code: 27, name: 'Uasin Gishu', capital: 'Eldoret', subCounties: ['Ainabkoi', 'Kapseret', 'Kesses', 'Moiben', 'Soy', 'Turbo'] },
    { code: 38, name: 'Vihiga', capital: 'Vihiga', subCounties: ['Emuhaya', 'Hamisi', 'Luanda', 'Sabatia', 'Vihiga'] },
    { code: 8, name: 'Wajir', capital: 'Wajir', subCounties: ['Eldas', 'Tarbaj', 'Wajir East', 'Wajir North', 'Wajir South', 'Wajir West'] },
    { code: 24, name: 'West Pokot', capital: 'Kapenguria', subCounties: ['Central Pokot', 'North Pokot', 'Pokot South', 'West Pokot'] }
  ];

  // When joining existing org, show a single confirm/contact screen
  // Retailers: role -> phone number -> sales channels -> store details -> category -> opening year -> payment terms (7 steps, indices 0-6)
  // Distributors: role -> phone number -> brand name+website+instagram+facebook -> fulfillment email -> product count -> store count -> primary category -> hear about us (8 steps, indices 0-7)
  const totalSteps = data.isJoiningExisting ? 1 : data.role === 'retailer' ? 7 : 8;
  const progress = data.isJoiningExisting 
    ? 100 
    : currentStep === 0 
      ? 0 
      : ((currentStep / (totalSteps - 1)) * 100);

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

    const unsubscribe = onAuthStateChanged(auth!, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db!, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          const userData = userDoc.data();
          // If we're in the middle of submitting or already redirecting, avoid additional navigation checks
          if (isSubmitting || isRedirecting) {
            setUser(user);
            setLoading(false);
            return;
          }
          // Only redirect to modules if onboarding is complete AND we're not currently submitting
          if (userDoc.exists() && userData?.onboardingCompleted) {
            // Check role and redirect accordingly
            if (userData.role === 'distributor') {
              router.push('/distributor-dashboard');
            } else {
              router.push('/modules');
            }
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
  }, [router, isSubmitting, isRedirecting]);

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
      let organizationDisplayName = data.organizationName; // Track for email
      
      if (data.isJoiningExisting && data.invitationId) {
        const userDocRef = doc(db!, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          role: data.role,
          organizationName: data.organizationName,
          contactNumber: data.contactNumber,
          phoneNumber: data.phoneNumber || '',
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
  const userDocRef = doc(db!, 'users', user.uid);
        // Generate a unique, slugified organization id
        const { orgId, displayName } = await ensureUniqueOrgId(data.organizationName)
        organizationDisplayName = displayName; // Store for email
        
        // For retailers, use sensible defaults for contact and location if not set
        // For distributors, use sensible defaults as well
        const contactNumber = data.contactNumber || user.email || 'Not provided';
        const location = data.location || data.organizationName || 'Kenya';
        const coordinates = data.coordinates || { lat: -1.2921, lng: 36.8219 }; // Nairobi default
        
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          role: data.role,
          organizationName: orgId,
          organizationDisplayName: displayName,
          contactNumber,
          phoneNumber: data.phoneNumber || '',
          location,
          coordinates,
          salesChannels: data.salesChannels || [],
          salesChannelDescription: data.salesChannelDescription || '',
          website: data.website || '',
          county: data.county || '',
          subCounty: data.subCounty || '',
          storeCategory: data.storeCategory || '',
          openingYear: data.openingYear || '',
          wholesaleProductCount: data.wholesaleProductCount || '',
          storeCount: data.storeCount || '',
          primaryCategory: data.primaryCategory || '',
          hearAboutUs: data.hearAboutUs || '',
          instagramHandle: data.instagramHandle || '',
          facebookHandle: data.facebookHandle || '',
          fulfillmentEmail: data.fulfillmentEmail || '',
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
      
      // Send welcome email after successful onboarding
      try {
        if (data.role === 'distributor') {
          // Send distributor-specific welcome email
          await fetch('/api/send-distributor-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'there',
              brandName: organizationDisplayName
            })
          });
        } else {
          // Send retailer welcome email
          await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'there',
              storeName: organizationDisplayName
            })
          });
        }
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't block onboarding if email fails
      }
      
      // Clear cached onboarding data after successful completion
      clearOnboardingCache();
      
      // Show loading state for a few seconds before redirect
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect based on role (keep flags true to prevent re-routing)
      setIsRedirecting(true);
      if (data.role === 'distributor') {
        router.push('/distributor-dashboard');
      } else {
        router.push('/modules');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete onboarding. Please try again.');
      setIsSubmitting(false);
      setIsRedirecting(false);
    }
  };

  const validateContactNumber = (number: string) => number.replace(/\D/g, '').length >= 9;
  const validateOrganizationName = (name: string) => name.trim().length >= 2 && name.trim().length <= 100;
  const validateURL = (url: string) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  
  const canProceed = () => {
    if (data.isJoiningExisting) {
      return data.contactNumber.trim() !== '' && validateContactNumber(data.contactNumber);
    }
    switch (currentStep) {
      case 0:
        return data.role !== null;
      case 1:
        // Step 1 for both: Phone number
        return data.phoneNumber?.trim() !== '' && validateContactNumber(data.phoneNumber || '');
      case 2:
        // For retailers, step 2 is sales channels
        if (data.role === 'retailer') {
          return (data.salesChannels?.length || 0) > 0;
        }
        // For distributors, step 2 is brand name + website (required) + county/subcounty if manual entry
        if (data.county && data.county !== 'manual') {
          // Manual entry mode: require name, county, and sub-county
          return validateOrganizationName(data.organizationName) && 
                 data.county.trim() !== '' && 
                 data.subCounty?.trim() !== '';
        }
        // Map picker mode or no mode selected: just require name and coordinates
        return validateOrganizationName(data.organizationName) && !!data.coordinates;
      case 3:
        // For retailers, step 3 is store name + validation based on sales channel
        if (data.role === 'retailer') {
          const hasBrickMortar = data.salesChannels?.includes('brick-mortar');
          const hasOnline = data.salesChannels?.includes('online');
          const hasPopup = data.salesChannels?.includes('popup');
          
          if (hasBrickMortar) {
            // If county is set (manual entry mode), need name, county, and sub-county
            if (data.county && data.county !== 'manual') {
              return validateOrganizationName(data.organizationName) && 
                     data.county.trim() !== '' && 
                     data.subCounty?.trim() !== '';
            }
            // If no county (map picker mode), need location from places picker
            return data.organizationName.trim() !== '' && !!data.coordinates;
          } else if (hasOnline) {
            // Need store name and valid website
            return validateOrganizationName(data.organizationName) && 
                   data.website?.trim() !== '' && 
                   validateURL(data.website || '');
          } else if (hasPopup) {
            // Need store name, county and sub-county
            return validateOrganizationName(data.organizationName) && 
                   data.county?.trim() !== '' && 
                   data.subCounty?.trim() !== '';
          }
          return validateOrganizationName(data.organizationName);
        }
        // For distributors, step 3 is fulfillment email
        return data.fulfillmentEmail?.trim() !== '' && validateEmail(data.fulfillmentEmail || '');
      case 4:
        // For retailers, step 4 is store category
        if (data.role === 'retailer') {
          return data.storeCategory?.trim() !== '';
        }
        // For distributors, step 4 is wholesale product count
        return data.wholesaleProductCount?.trim() !== '';
      case 5:
        // For retailers, step 5 is opening year
        if (data.role === 'retailer') {
          return data.openingYear?.trim() !== '';
        }
        // For distributors, step 5 is store count
        return data.storeCount?.trim() !== '';
      case 6:
        // For retailers, step 6 is payment terms (always can proceed)
        if (data.role === 'retailer') {
          return true;
        }
        // For distributors, step 6 is primary category
        return data.primaryCategory?.trim() !== '';
      case 7:
        // For distributors, step 7 is "how did you hear about us" (optional, always can proceed)
        return true;
      default:
        return false;
    }
  };

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  return (
    <>
      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(56, 189, 248, 0.5);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(56, 189, 248, 0.7);
        }
      `}</style>
      <div className={`module-background relative min-h-screen w-full overflow-hidden px-6 py-16 sm:px-10 lg:px-16 ${neueHaas.className}`}>
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
                  <span>{data.isJoiningExisting ? 'Accepting Invitation' : `Step ${currentStep}`}</span>
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
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">Hi {user?.displayName?.split(' ')[0] || 'there'}, what type of organization are you setting up?</h2>
                        </div>
                        <div className="space-y-4">
                          <button
                            onClick={() => setData({ ...data, role: 'retailer' })}
                            className={`group w-full rounded-2xl border overflow-hidden text-left transition-all duration-300 ${
                              data.role === 'retailer'
                                ? 'border-sky-300/60 bg-sky-500/15 text-white shadow-[0_8px_24px_-8px_rgba(56,189,248,0.3)]'
                                : 'border-white/12 bg-white/6 text-slate-200 hover:border-sky-200/40 hover:bg-sky-400/10'
                            }`}
                          >
                            <div className="flex items-stretch">
                              <div className={`w-1/2 flex-shrink-0 ${
                                data.role === 'retailer'
                                  ? 'bg-sky-500/20'
                                  : 'bg-white/8'
                              }`}>
                                <img 
                                  src="/retailer.jpg" 
                                  alt="Retailer" 
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex flex-1 items-center px-5 py-4">
                                <div className="flex-1">
                                  <div className="text-base font-semibold text-slate-100">Retailer</div>
                                  <div className="text-sm text-slate-300/80">We sell to end consumers, we want to buy wholesale items on Vendai</div>
                                </div>
                                {data.role === 'retailer' && (
                                  <CheckCircle className="ml-4 h-5 w-5 flex-shrink-0 text-sky-200" />
                                )}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setData({ ...data, role: 'distributor' })}
                            className={`group w-full rounded-2xl border overflow-hidden text-left transition-all duration-300 ${
                              data.role === 'distributor'
                                ? 'border-indigo-300/60 bg-indigo-500/15 text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.3)]'
                                : 'border-white/12 bg-white/6 text-slate-200 hover:border-indigo-200/45 hover:bg-indigo-400/10'
                            }`}
                          >
                            <div className="flex items-stretch">
                              <div className={`w-1/2 flex-shrink-0 ${
                                data.role === 'distributor'
                                  ? 'bg-indigo-500/20'
                                  : 'bg-white/8'
                              }`}>
                                <img 
                                  src="/distributor.jpg" 
                                  alt="Distributor" 
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex flex-1 items-center px-5 py-4">
                                <div className="flex-1">
                                  <div className="text-base font-semibold text-slate-100">Distributor / Wholesaler / Supplier</div>
                                  <div className="text-sm text-slate-300/80">We sell to retailers, we want to sell wholesale items on Vendai</div>
                                </div>
                                {data.role === 'distributor' && (
                                  <CheckCircle className="ml-4 h-5 w-5 flex-shrink-0 text-indigo-200" />
                                )}
                              </div>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 1 for Both: Phone Number */}
                    {!data.isJoiningExisting && currentStep === 1 && (
                      <motion.div
                        key="phone-number"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center space-y-2">
                          <h2 className="text-xl font-semibold text-slate-100">What's your phone number?</h2>
                          <p className="text-sm text-slate-400">We'll use this to contact you about your orders</p>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-200">Phone Number</label>
                          <input
                            type="tel"
                            value={data.phoneNumber || ''}
                            onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
                            placeholder="e.g. +254712345678"
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                              data.phoneNumber && !validateContactNumber(data.phoneNumber)
                                ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                            }`}
                          />
                          {data.phoneNumber && !validateContactNumber(data.phoneNumber) && (
                            <p className="mt-2 text-xs text-red-400">Please enter a valid phone number (e.g. +254712345678)</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2 for Retailers: Sales Channels */}
                    {!data.isJoiningExisting && currentStep === 2 && data.role === 'retailer' && (
                      <motion.div
                        key="sales-channels"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">Where do you sell your products?</h2>
                        </div>
                        <div className="space-y-3">
                          {[
                            { id: 'brick-mortar', label: 'Brick and mortar store', description: 'A permanent retail location' },
                            { id: 'online', label: 'Online', description: 'My website or social channel' },
                            { id: 'popup', label: 'Pop-up shop', description: 'A temporary retail location' },
                            { id: 'other', label: 'Somewhere else', description: '' }
                          ].map((channel) => {
                            const isSelected = data.salesChannels?.includes(channel.id);
                            const isOther = channel.id === 'other';
                            return (
                              <div key={channel.id}>
                                <button
                                  onClick={() => {
                                    const current = data.salesChannels || [];
                                    if (isSelected) {
                                      setData({ ...data, salesChannels: current.filter(c => c !== channel.id) });
                                    } else {
                                      setData({ ...data, salesChannels: [...current, channel.id] });
                                    }
                                  }}
                                  className={`w-full rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
                                    isSelected
                                      ? 'border-sky-300/60 bg-sky-500/15'
                                      : 'border-white/12 bg-white/6 hover:border-sky-200/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-slate-100">{channel.label}</div>
                                      {channel.description && (
                                        <div className="text-xs text-slate-300/70">{channel.description}</div>
                                      )}
                                    </div>
                                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                                      isSelected ? 'border-sky-300 bg-sky-500' : 'border-white/30'
                                    }`}>
                                      {isSelected && (
                                        <CheckCircle className="h-4 w-4 text-white" />
                                      )}
                                    </div>
                                  </div>
                                </button>
                                {isOther && isSelected && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3"
                                  >
                                    <label className="mb-2 block text-xs text-slate-300/80">Describe where you sell your products</label>
                                    <textarea
                                      value={data.salesChannelDescription || ''}
                                      onChange={(e) => setData({ ...data, salesChannelDescription: e.target.value })}
                                      placeholder="Tell us more..."
                                      maxLength={250}
                                      rows={3}
                                      className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25"
                                    />
                                    <div className="mt-1 text-right text-xs text-slate-400">{data.salesChannelDescription?.length || 0}/250</div>
                                  </motion.div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-center">
                          <button
                            onClick={() => setShowRetailerWarning(true)}
                            className="text-sm text-slate-400 underline transition hover:text-slate-300"
                          >
                            I&rsquo;m just shopping for myself
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2 for Distributors / Step 3 for Retailers: Store/Brand Name */}
                    {!data.isJoiningExisting && 
                     ((currentStep === 2 && data.role === 'distributor') || (currentStep === 3 && data.role === 'retailer')) && (
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
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">
                            {data.role === 'retailer' ? "What's your store's name?" : "What's your brand name?"}
                          </h2>
                        </div>
                        <div className="space-y-6">
                          {/* Brick & Mortar: Use Places Picker or Manual Entry */}
                          {data.role === 'retailer' && data.salesChannels?.includes('brick-mortar') && (
                            <>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Store className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Store name</label>
                                </div>
                                {!data.county ? (
                                  <GoogleMapsWrapper apiKey={mapsApiKey}>
                                    <LocationPickerWithMap
                                      value={data.organizationName}
                                      onLocationSelect={(location: string, coordinates?: { lat: number; lng: number }, placeData?: { website?: string; placeId?: string; name?: string; county?: string; subCounty?: string }) => {
                                        const updates: Partial<OnboardingData> = { 
                                          organizationName: location, 
                                          location, 
                                          coordinates 
                                        };
                                        // Autofill website if available from Google Places
                                        if (placeData?.website && !data.website) {
                                          updates.website = placeData.website;
                                        }
                                        // Autofill county and subcounty if available
                                        if (placeData?.county) {
                                          updates.county = placeData.county;
                                        }
                                        if (placeData?.subCounty) {
                                          updates.subCounty = placeData.subCounty;
                                        }
                                        setData({ ...data, ...updates });
                                      }}
                                      placeholder="Search for your store location..."
                                    />
                                  </GoogleMapsWrapper>
                                ) : (
                                  <input
                                    type="text"
                                    value={data.organizationName}
                                    onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                                    placeholder="e.g. Mambo Retail"
                                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                      data.organizationName && !validateOrganizationName(data.organizationName)
                                        ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                        : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                    }`}
                                    autoFocus
                                  />
                                )}
                                {data.organizationName && data.county && !validateOrganizationName(data.organizationName) && (
                                  <p className="mt-2 text-xs text-red-300/80">Store name must be at least 2 characters long.</p>
                                )}
                                <button
                                  onClick={() => {
                                    if (data.county) {
                                      // Switch back to map picker
                                      setData({ ...data, county: '', subCounty: '', organizationName: '', coordinates: undefined });
                                    } else {
                                      // Enable manual entry
                                      setData({ ...data, county: 'manual' });
                                    }
                                  }}
                                  className="mt-2 text-sm text-sky-300 underline transition hover:text-sky-200"
                                >
                                  {data.county ? 'Use location search instead' : 'Enter manually'}
                                </button>
                              </div>
                              {data.county && data.county !== 'manual' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-200">County</label>
                                    <select
                                      value={data.county || ''}
                                      onChange={(e) => {
                                        setData({ ...data, county: e.target.value, subCounty: '' });
                                      }}
                                      className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                    >
                                      <option value="">Select county</option>
                                      {kenyanCounties.map(county => (
                                        <option key={county.code} value={county.name}>{county.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-200">Sub-County</label>
                                    <select
                                      value={data.subCounty || ''}
                                      onChange={(e) => setData({ ...data, subCounty: e.target.value })}
                                      disabled={!data.county || data.county === 'manual'}
                                      className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                    >
                                      <option value="">Select sub-county</option>
                                      {data.county && data.county !== 'manual' && kenyanCounties.find(c => c.name === data.county)?.subCounties.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Building className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Website <span className="text-slate-400">(optional)</span></label>
                                </div>
                                <input
                                  type="url"
                                  value={data.website || ''}
                                  onChange={(e) => setData({ ...data, website: e.target.value })}
                                  placeholder="e.g. https://mystore.com"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.website && !validateURL(data.website)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                />
                                {data.website && !validateURL(data.website) && (
                                  <p className="mt-2 text-xs text-red-300/80">Please enter a valid URL</p>
                                )}
                              </div>
                            </>
                          )}

                          {/* Online: Store Name + Website (mandatory) */}
                          {data.role === 'retailer' && data.salesChannels?.includes('online') && !data.salesChannels?.includes('brick-mortar') && (
                            <>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Store className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Store name</label>
                                </div>
                                <input
                                  type="text"
                                  value={data.organizationName}
                                  onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                                  placeholder="e.g. Mambo Retail"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.organizationName && !validateOrganizationName(data.organizationName)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                  autoFocus
                                />
                                {data.organizationName && !validateOrganizationName(data.organizationName) && (
                                  <p className="mt-2 text-xs text-red-300/80">Store name must be at least 2 characters long.</p>
                                )}
                              </div>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Building className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Website</label>
                                </div>
                                <input
                                  type="url"
                                  value={data.website || ''}
                                  onChange={(e) => setData({ ...data, website: e.target.value })}
                                  placeholder="e.g. https://mystore.com"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.website && !validateURL(data.website)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                />
                                {data.website && !validateURL(data.website) && (
                                  <p className="mt-2 text-xs text-red-300/80">Please enter a valid URL</p>
                                )}
                              </div>
                            </>
                          )}

                          {/* Pop-up Shop: Store Name + County + Sub-County + Optional Website */}
                          {data.role === 'retailer' && data.salesChannels?.includes('popup') && !data.salesChannels?.includes('brick-mortar') && !data.salesChannels?.includes('online') && (
                            <>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Store className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Store name</label>
                                </div>
                                <input
                                  type="text"
                                  value={data.organizationName}
                                  onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                                  placeholder="e.g. Mambo Pop-up"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.organizationName && !validateOrganizationName(data.organizationName)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                  autoFocus
                                />
                                {data.organizationName && !validateOrganizationName(data.organizationName) && (
                                  <p className="mt-2 text-xs text-red-300/80">Store name must be at least 2 characters long.</p>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-200">County</label>
                                  <select
                                    value={data.county || ''}
                                    onChange={(e) => {
                                      setData({ ...data, county: e.target.value, subCounty: '' });
                                    }}
                                    className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                  >
                                    <option value="">Select county</option>
                                    {kenyanCounties.map(county => (
                                      <option key={county.code} value={county.name}>{county.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-200">Sub-County</label>
                                  <select
                                    value={data.subCounty || ''}
                                    onChange={(e) => setData({ ...data, subCounty: e.target.value })}
                                    disabled={!data.county}
                                    className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                  >
                                    <option value="">Select sub-county</option>
                                    {data.county && kenyanCounties.find(c => c.name === data.county)?.subCounties.map(sub => (
                                      <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Building className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Website <span className="text-slate-400">(optional)</span></label>
                                </div>
                                <input
                                  type="url"
                                  value={data.website || ''}
                                  onChange={(e) => setData({ ...data, website: e.target.value })}
                                  placeholder="e.g. https://mystore.com"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.website && !validateURL(data.website)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                />
                                {data.website && !validateURL(data.website) && (
                                  <p className="mt-2 text-xs text-red-300/80">Please enter a valid URL</p>
                                )}
                              </div>
                            </>
                          )}

                          {/* Other/Default: Just store name + optional website */}
                          {data.role === 'retailer' && 
                           !data.salesChannels?.includes('brick-mortar') && 
                           !data.salesChannels?.includes('online') && 
                           !data.salesChannels?.includes('popup') && (
                            <>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Store className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Store name</label>
                                </div>
                                <input
                                  type="text"
                                  value={data.organizationName}
                                  onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                                  placeholder="e.g. Mambo Retail"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.organizationName && !validateOrganizationName(data.organizationName)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                  autoFocus
                                />
                                {data.organizationName && !validateOrganizationName(data.organizationName) && (
                                  <p className="mt-2 text-xs text-red-300/80">Store name must be at least 2 characters long.</p>
                                )}
                              </div>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Building className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Website <span className="text-slate-400">(optional)</span></label>
                                </div>
                                <input
                                  type="url"
                                  value={data.website || ''}
                                  onChange={(e) => setData({ ...data, website: e.target.value })}
                                  placeholder="e.g. https://mystore.com"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.website && !validateURL(data.website)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                />
                                {data.website && !validateURL(data.website) && (
                                  <p className="mt-2 text-xs text-red-300/80">Please enter a valid URL</p>
                                )}
                              </div>
                            </>
                          )}

                          {/* Distributor: brand name + website (required) + instagram (optional) + facebook (optional) */}
                          {data.role === 'distributor' && (
                            <>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Building className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Brand name</label>
                                </div>
                                {!data.county ? (
                                  <GoogleMapsWrapper apiKey={mapsApiKey}>
                                    <LocationPickerWithMap
                                      value={data.organizationName}
                                      onLocationSelect={(location: string, coordinates?: { lat: number; lng: number }, placeData?: { website?: string; placeId?: string; name?: string; county?: string; subCounty?: string }) => {
                                        const updates: Partial<OnboardingData> = { 
                                          organizationName: location, 
                                          location, 
                                          coordinates 
                                        };
                                        // Autofill website if available from Google Places
                                        if (placeData?.website && !data.website) {
                                          updates.website = placeData.website;
                                        }
                                        // Autofill county and subcounty if available
                                        if (placeData?.county) {
                                          updates.county = placeData.county;
                                        }
                                        if (placeData?.subCounty) {
                                          updates.subCounty = placeData.subCounty;
                                        }
                                        setData({ ...data, ...updates });
                                      }}
                                      placeholder="Search for your brand location..."
                                    />
                                  </GoogleMapsWrapper>
                                ) : (
                                  <input
                                    type="text"
                                    value={data.organizationName}
                                    onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                                    placeholder="e.g. Fresh Foods"
                                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                      data.organizationName && !validateOrganizationName(data.organizationName)
                                        ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                        : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                    }`}
                                    autoFocus
                                  />
                                )}
                                {data.organizationName && data.county && !validateOrganizationName(data.organizationName) && (
                                  <p className="mt-2 text-xs text-red-300/80">Brand name must be at least 2 characters long.</p>
                                )}
                                <button
                                  onClick={() => {
                                    if (data.county) {
                                      // Switch back to map picker
                                      setData({ ...data, county: '', subCounty: '', organizationName: '', coordinates: undefined });
                                    } else {
                                      // Enable manual entry
                                      setData({ ...data, county: 'manual' });
                                    }
                                  }}
                                  className="mt-2 text-sm text-sky-300 underline transition hover:text-sky-200"
                                >
                                  {data.county ? 'Use location search instead' : 'Enter manually'}
                                </button>
                              </div>
                              {data.county && data.county !== 'manual' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-200">County</label>
                                    <select
                                      value={data.county || ''}
                                      onChange={(e) => {
                                        setData({ ...data, county: e.target.value, subCounty: '' });
                                      }}
                                      className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                    >
                                      <option value="">Select county</option>
                                      {kenyanCounties.map(county => (
                                        <option key={county.code} value={county.name}>{county.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-200">Sub-County</label>
                                    <select
                                      value={data.subCounty || ''}
                                      onChange={(e) => setData({ ...data, subCounty: e.target.value })}
                                      disabled={!data.county || data.county === 'manual'}
                                      className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                    >
                                      <option value="">Select sub-county</option>
                                      {data.county && data.county !== 'manual' && kenyanCounties.find(c => c.name === data.county)?.subCounties.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <Building className="h-4 w-4 text-slate-200" />
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Website</label>
                                </div>
                                <input
                                  type="url"
                                  value={data.website || ''}
                                  onChange={(e) => setData({ ...data, website: e.target.value })}
                                  placeholder="e.g. https://yourcompany.com"
                                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                                    data.website && !validateURL(data.website)
                                      ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                      : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                                  }`}
                                />
                                {data.website && !validateURL(data.website) && (
                                  <p className="mt-2 text-xs text-red-300/80">Please enter a valid URL</p>
                                )}
                              </div>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <svg className="h-4 w-4 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                    </svg>
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Instagram <span className="text-slate-400">(optional)</span></label>
                                </div>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">instagram.com/</span>
                                  <input
                                    type="text"
                                    value={data.instagramHandle || ''}
                                    onChange={(e) => setData({ ...data, instagramHandle: e.target.value.replace('@', '') })}
                                    className="w-full rounded-2xl border border-white/15 bg-white/[0.06] pl-[130px] pr-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25"
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                                    <svg className="h-4 w-4 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                  </div>
                                  <label className="text-sm font-medium text-slate-200">Facebook <span className="text-slate-400">(optional)</span></label>
                                </div>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">facebook.com/</span>
                                  <input
                                    type="text"
                                    value={data.facebookHandle || ''}
                                    onChange={(e) => setData({ ...data, facebookHandle: e.target.value })}
                                    className="w-full rounded-2xl border border-white/15 bg-white/[0.06] pl-[125px] pr-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25"
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4 for Retailers: Store Category */}
                    {!data.isJoiningExisting && currentStep === 4 && data.role === 'retailer' && (
                      <motion.div
                        key="category"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">Which of these best describes your store?</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {storeCategories.map((category) => {
                            const isSelected = data.storeCategory === category.id;
                            return (
                              <button
                                key={category.id}
                                onClick={() => setData({ ...data, storeCategory: category.id })}
                                className={`relative rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                                  isSelected
                                    ? 'border-sky-300/60 bg-sky-500/15 shadow-[0_12px_35px_-20px_rgba(56,189,248,0.65)]'
                                    : 'border-white/12 bg-white/6 hover:border-sky-200/40 hover:bg-sky-400/10'
                                }`}
                              >
                                <div className={`text-sm font-medium ${
                                  isSelected ? 'text-slate-100' : 'text-slate-200'
                                }`}>
                                  {category.label}
                                </div>
                                {isSelected && (
                                  <div className="absolute top-2 right-2">
                                    <CheckCircle className="h-4 w-4 text-sky-200" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 5 for Retailers: Opening Year */}
                    {!data.isJoiningExisting && currentStep === 5 && data.role === 'retailer' && (
                      <motion.div
                        key="opening-year"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">When did your store open?</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {openingYearOptions.map((option) => {
                            const isSelected = data.openingYear === option.id;
                            return (
                              <button
                                key={option.id}
                                onClick={() => setData({ ...data, openingYear: option.id })}
                                className={`relative rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                                  isSelected
                                    ? 'border-sky-300/60 bg-sky-500/15 shadow-[0_12px_35px_-20px_rgba(56,189,248,0.65)]'
                                    : 'border-white/12 bg-white/6 hover:border-sky-200/40 hover:bg-sky-400/10'
                                }`}
                              >
                                <span className="text-sm font-medium text-slate-100">{option.label}</span>
                                {isSelected && (
                                  <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-sky-200" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 6 for Retailers: Payment Terms */}
                    {!data.isJoiningExisting && currentStep === 6 && data.role === 'retailer' && (
                      <motion.div
                        key="payment-terms"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-4 text-2xl font-semibold text-slate-100">Congrats! You&rsquo;ve got payment terms</h2>
                          <p className="text-sm text-slate-300/80">
                            This means you can buy inventory today and pay up to 60 days later—interest-free.
                          </p>
                        </div>
                        
                        {/* Credit Card Style */}
                        <div className="mx-auto max-w-md">
                          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-8 shadow-2xl">
                            {/* Card shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
                            
                            {/* Card content */}
                            <div className="relative z-10">
                              <div className="mb-8 flex items-center justify-between">
                                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Payment Terms</div>
                                <div className="flex gap-1">
                                  <div className="h-8 w-8 rounded-full bg-red-500/80" />
                                  <div className="h-8 w-8 -ml-3 rounded-full bg-orange-500/80" />
                                </div>
                              </div>
                              
                              <div className="mb-6">
                                <div className="mb-2 text-sm font-medium text-slate-400">Available Credit</div>
                                <div className="text-5xl font-bold tracking-tight text-green-400">KES 20,000</div>
                              </div>
                              
                              <div className="flex items-end justify-between">
                                <div>
                                  <div className="mb-1 text-xs text-slate-500">Store Name</div>
                                  <div className="text-sm font-medium text-slate-200">{data.organizationName || 'Your Store'}</div>
                                </div>
                                <div className="text-right">
                                  <div className="mb-1 text-xs text-slate-500">Valid Thru</div>
                                  <div className="text-sm font-medium text-slate-200">12/26</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-center text-xs text-slate-400">
                          We use manual and automated processes to verify all retailers on Vendai.
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3 for Distributors: Fulfillment Email */}
                    {!data.isJoiningExisting && currentStep === 3 && data.role === 'distributor' && (
                      <motion.div
                        key="fulfillment-email"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center space-y-2">
                          <h2 className="text-xl font-semibold text-slate-100">Fulfillment email</h2>
                          <p className="text-sm text-slate-400">For order confirmations and shipping updates</p>
                        </div>
                        <div>
                          <input
                            type="email"
                            value={data.fulfillmentEmail || ''}
                            onChange={(e) => setData({ ...data, fulfillmentEmail: e.target.value })}
                            placeholder="e.g. orders@yourcompany.com"
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder-slate-400 transition-all duration-200 backdrop-blur-lg ${
                              data.fulfillmentEmail && !validateEmail(data.fulfillmentEmail)
                                ? 'border-red-500/40 bg-red-500/10 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                                : 'border-white/15 bg-white/[0.06] hover:border-sky-200/40 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/25'
                            }`}
                          />
                          {data.fulfillmentEmail && !validateEmail(data.fulfillmentEmail) && (
                            <p className="mt-2 text-xs text-red-300/80">Please enter a valid email address</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4 for Distributors: Wholesale Product Count */}
                    {!data.isJoiningExisting && currentStep === 4 && data.role === 'distributor' && (
                      <motion.div
                        key="product-count"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">How many wholesale products do you sell?</h2>
                        </div>
                        <div>
                          <select
                            value={data.wholesaleProductCount || ''}
                            onChange={(e) => setData({ ...data, wholesaleProductCount: e.target.value })}
                            className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-slate-100"
                          >
                            <option value="">Select an option</option>
                            <option value="none">I do not currently sell wholesale products</option>
                            <option value="1-10">1-10</option>
                            <option value="11-25">11-25</option>
                            <option value="26-50">26-50</option>
                            <option value="51-100">51-100</option>
                            <option value="100+">More than 100</option>
                          </select>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 5 for Distributors: Store Count */}
                    {!data.isJoiningExisting && currentStep === 5 && data.role === 'distributor' && (
                      <motion.div
                        key="store-count"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">How many independent stores do you work with?</h2>
                        </div>
                        <div>
                          <select
                            value={data.storeCount || ''}
                            onChange={(e) => setData({ ...data, storeCount: e.target.value })}
                            className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-slate-100"
                          >
                            <option value="">Select an option</option>
                            <option value="new">I am new to wholesale</option>
                            <option value="1-10">1-10</option>
                            <option value="11-25">11-25</option>
                            <option value="26-50">26-50</option>
                            <option value="51-100">51-100</option>
                            <option value="101-250">101-250</option>
                            <option value="251-500">251-500</option>
                            <option value="500-1000">500-1000</option>
                            <option value="1000+">More than 1000</option>
                          </select>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 6 for Distributors: Primary Category */}
                    {!data.isJoiningExisting && currentStep === 6 && data.role === 'distributor' && (
                      <motion.div
                        key="primary-category"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">Which of these best describes your products?</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {storeCategories.map((category) => {
                            const isSelected = data.primaryCategory === category.id;
                            return (
                              <button
                                key={category.id}
                                onClick={() => setData({ ...data, primaryCategory: category.id })}
                                className={`relative rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                                  isSelected
                                    ? 'border-sky-300/60 bg-sky-500/15 shadow-[0_12px_35px_-20px_rgba(56,189,248,0.65)]'
                                    : 'border-white/12 bg-white/6 hover:border-sky-200/40 hover:bg-sky-400/10'
                                }`}
                              >
                                <div className={`text-sm font-medium ${
                                  isSelected ? 'text-slate-100' : 'text-slate-200'
                                }`}>
                                  {category.label}
                                </div>
                                {isSelected && (
                                  <div className="absolute top-2 right-2">
                                    <CheckCircle className="h-4 w-4 text-sky-200" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 7 for Distributors: How Did You Hear About Us (Optional) */}
                    {!data.isJoiningExisting && currentStep === 7 && data.role === 'distributor' && (
                      <motion.div
                        key="hear-about-us"
                        variants={slideVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-7"
                      >
                        <div className="text-center">
                          <h2 className="mb-2 text-xl font-semibold text-slate-100">How did you hear about us? (Optional)</h2>
                        </div>
                        <div>
                          <select
                            value={data.hearAboutUs || ''}
                            onChange={(e) => setData({ ...data, hearAboutUs: e.target.value })}
                            className="w-full rounded-2xl border border-sky-300/30 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-200 hover:border-sky-300/50 hover:from-white/[0.09] hover:to-white/[0.04] focus:border-sky-300/60 focus:from-white/[0.10] focus:to-white/[0.05] focus:ring-2 focus:ring-sky-400/25 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-slate-100"
                          >
                            <option value="">Select an option</option>
                            <option value="social-media">Social Media</option>
                            <option value="another-brand">Another Brand</option>
                            <option value="retailer">A Retailer</option>
                            <option value="vendai-employee">A Vendai employee</option>
                            <option value="other">Other</option>
                          </select>
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

      {/* Retailer-only warning modal */}
      {showRetailerWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-3xl border border-white/12 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-300/40 bg-indigo-500/15">
                <AlertCircle className="h-8 w-8 text-indigo-200" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-slate-100">Vendai is only available to retailers</h2>
              <p className="text-sm text-slate-300/80">
                Vendai is a wholesale marketplace designed for retail shops to find and order inventory for their stores.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <p className="text-sm text-slate-300/90">
                If you are interested in starting a Retailer store Vendai can help you! We have a program called Open With Vendai that can help new retailers open their dream store.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => setShowRetailerWarning(false)}
                variant="outline"
                className="flex-1 rounded-xl border border-white/12 bg-white/8 text-slate-200 transition hover:border-sky-200/40 hover:bg-white/12"
              >
                Go back
              </Button>
              <Button
                onClick={() => window.open('https://vendai.digital', '_blank')}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-500/90 via-cyan-400/90 to-indigo-500/90 text-slate-950 shadow-[0_18px_45px_-25px_rgba(56,189,248,0.85)]"
              >
                Learn More
              </Button>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </>
  );
}