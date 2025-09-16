import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Building, 
  MapPin, 
  Crown, 
  Calendar,
  Edit2,
  Save,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '@/contexts/auth-context';
import { LocationPickerWithMap } from '@/components/ui/location-picker-with-map';

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role: 'retailer' | 'distributor';
  organizationName: string;
  contactNumber?: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
  isOrganizationCreator: boolean;
  createdAt: string;
  joinedAt?: string;
  updatedAt?: string;
  photoURL?: string;
}

interface ProfileManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileManagement: React.FC<ProfileManagementProps> = ({ isOpen, onClose }) => {
  const { user, userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>();

  // Load data when modal opens and user/userData are available
  useEffect(() => {
    if (isOpen && user && userData) {
      initializeFormData();
      setLoading(false);
    }
  }, [isOpen, user, userData]);

  const initializeFormData = () => {
    if (userData) {
      setDisplayName(userData.displayName || user?.displayName || '');
      setContactNumber(userData.contactNumber || '');
      setLocation(userData.location || '');
      setCoordinates(userData.coordinates);
    }
  };

  const saveProfile = async () => {
    if (!user || !userData) return;

    setIsSaving(true);
    try {
      // Update Firestore document
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim() || null,
        contactNumber: contactNumber.trim() || null,
        location: location.trim() || null,
        coordinates: coordinates || null,
        updatedAt: new Date().toISOString()
      });

      // Update Firebase Auth profile if display name changed
      if (displayName.trim() && displayName.trim() !== user.displayName) {
        await updateProfile(user, {
          displayName: displayName.trim()
        });
      }

      // Refresh user data from context
      await refreshUserData();
      setIsEditing(false);
      
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    if (!userData) return;
    
    // Reset form to original values
    setDisplayName(userData.displayName || '');
    setContactNumber(userData.contactNumber || '');
    setLocation(userData.location || '');
    setCoordinates(userData.coordinates);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Profile Management</h2>
                <p className="text-sm text-slate-400">Manage your personal information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading profile...</p>
            </div>
          ) : (
            <div className="p-6 max-h-96 overflow-y-auto">
              {/* Profile Header */}
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center">
                    {userData?.photoURL || user?.photoURL ? (
                      <img
                        src={userData?.photoURL || user?.photoURL || ''}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-semibold text-slate-300">
                        {getInitials(userData?.displayName, user?.email || '')}
                      </span>
                    )}
                  </div>
                  <button
                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors"
                    title="Change profile picture"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">
                      {userData?.displayName || user?.email?.split('@')[0] || 'User'}
                    </h3>
                    {userData?.isOrganizationCreator && (
                      <div title="Organization Creator">
                        <Crown className="w-5 h-5 text-yellow-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-slate-400">{user?.email}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {userData?.organizationName}
                    </span>
                    <span className="flex items-center gap-1 capitalize">
                      <User className="w-4 h-4" />
                      {userData?.role}
                    </span>
                  </div>
                </div>

                {!isEditing && (
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>

              {/* Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">Personal Information</h4>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Display Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                        className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-white">
                          {userData?.displayName || 'Not set'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Email Address</label>
                    <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-white">{user?.email}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Contact Number</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-white">
                          {userData?.contactNumber || 'Not set'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Organization & Location */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">Organization & Location</h4>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Organization</label>
                    <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                      <Building className="w-4 h-4 text-slate-400" />
                      <span className="text-white">{userData?.organizationName}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Role</label>
                    <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-white capitalize">{userData?.role}</span>
                      {userData?.isOrganizationCreator && (
                        <span className="ml-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                          Creator
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Location</label>
                    {isEditing ? (
                      <LocationPickerWithMap
                        value={location}
                        onLocationSelect={(newLocation, newCoordinates) => {
                          setLocation(newLocation);
                          setCoordinates(newCoordinates);
                        }}
                        placeholder="Search for your location..."
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-white">
                          {userData?.location || 'Not set'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Member Since</label>
                    <div className="flex items-center gap-2 p-3 bg-slate-800/20 rounded-lg">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-white">
                        {userData?.createdAt ? formatDate(userData.createdAt) : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-4 mt-8 pt-6 border-t border-slate-600/30">
                  <Button
                    onClick={saveProfile}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={cancelEdit}
                    variant="outline"
                    disabled={isSaving}
                    className="border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};