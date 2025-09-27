import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Building, 
  Users, 
  Mail, 
  Phone, 
  MapPin, 
  Crown, 
  Copy, 
  Plus,
  Trash2,
  Send,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { 
  createInvitation,
  getUserInvitations,
    getOrganizationInvitations,
  cancelInvitation,
  resendInvitation,
  deleteInvitation,
  InvitationData 
} from '@/lib/invitation-operations';
import { notifyOrganizationUpdate } from '@/lib/notification-operations';

interface OrganizationMember {
  uid: string;
  email: string;
  displayName?: string;
  role: 'retailer' | 'distributor';
  isOrganizationCreator: boolean;
  joinedAt: string;
  contactNumber?: string;
}

interface UserData {
  uid: string;
  email: string;
  role: 'retailer' | 'distributor';
  organizationName: string;
  contactNumber?: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
  isOrganizationCreator: boolean;
  displayName?: string;
}

interface OrganizationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ isOpen, onClose }) => {
  const { user, userData, refreshUserData } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<(InvitationData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'settings'>('members');

  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'retailer' | 'distributor'>('retailer');
  const [isInviting, setIsInviting] = useState(false);

  // Organization settings form state
  const [orgName, setOrgName] = useState('');
  const [orgLocation, setOrgLocation] = useState('');
  const [orgContactNumber, setOrgContactNumber] = useState('');
  const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && user && userData) {
      loadData();
    }
  }, [isOpen, user, userData]);

  const loadData = async () => {
    if (!user || !userData) return;

    setLoading(true);
    try {
      // Initialize org settings with user data
      setOrgName(userData.organizationName);
      setOrgLocation(userData.location || '');
      setOrgContactNumber(userData.contactNumber || '');
      setInviteRole(userData.role);

      // Load organization members
      if (userData.organizationName) {
        await loadMembers(userData.organizationName);
        
        // Load invitations (only for organization creators)
        if (userData.isOrganizationCreator) {
          await loadInvitations();
        }
      }
    } catch (error) {
      console.error('Error loading organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (organizationName: string) => {
    try {
      const membersQuery = query(
        collection(db, 'users'),
        where('organizationName', '==', organizationName)
      );
      const snapshot = await getDocs(membersQuery);
      
      const membersList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as OrganizationMember[];

      // Sort by creator first, then by join date
      membersList.sort((a, b) => {
        if (a.isOrganizationCreator && !b.isOrganizationCreator) return -1;
        if (!a.isOrganizationCreator && b.isOrganizationCreator) return 1;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      });

      setMembers(membersList);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadInvitations = async () => {
    if (!user || !userData?.organizationName) return;

    try {
      // Prefer organization-level invites, fallback to user-sent invites
      const orgRes = await getOrganizationInvitations(userData.organizationName);
      if (orgRes.success && orgRes.invitations) {
        setInvitations(orgRes.invitations);
        return;
      }
      const userRes = await getUserInvitations(user.uid);
      if (userRes.success && userRes.invitations) {
        setInvitations(userRes.invitations);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const sendInvitation = async () => {
    if (!user || !userData || !inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const result = await createInvitation(user.uid, {
        inviteeEmail: inviteEmail.trim(),
        role: inviteRole
      });

      if (result.success) {
        setInviteEmail('');
        await loadInvitations(); // Reload invitations
        
        // Show success (you could add a toast notification here)
        console.log('Invitation sent successfully');
      } else {
        console.error('Failed to send invitation:', result.error);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!user) return;

    try {
      const result = await cancelInvitation(invitationId, user.uid);
      if (result.success) {
        await loadInvitations();
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!user) return;

    try {
      const result = await resendInvitation(invitationId, user.uid);
      if (result.success) {
        await loadInvitations();
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
    }
  };

  const copyInvitationLink = (invitationId: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/onboarding?invite=${invitationId}`;
    navigator.clipboard.writeText(link);
    // Show success (you could add a toast notification here)
  };

  const updateOrganizationSettings = async () => {
    if (!user || !userData) return;

    setIsUpdatingOrg(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        organizationName: orgName,
        location: orgLocation,
        contactNumber: orgContactNumber,
        updatedAt: new Date().toISOString()
      });

      // Notify organization members if name changed
      if (orgName !== userData.organizationName) {
        await notifyOrganizationUpdate(
          userData.organizationName,
          `Organization name changed to ${orgName}`,
          user.uid
        );
      }

      // Reload data
      await loadData();
      console.log('Organization updated successfully');
    } catch (error) {
      console.error('Error updating organization:', error);
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  const getInvitationStatus = (invitation: InvitationData & { id: string }) => {
    if (invitation.accepted) {
      return { status: 'accepted', icon: CheckCircle, color: 'text-green-400', label: 'Accepted' };
    }
    if (invitation.cancelled) {
      return { status: 'cancelled', icon: XCircle, color: 'text-red-400', label: 'Cancelled' };
    }
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return { status: 'expired', icon: Clock, color: 'text-yellow-400', label: 'Expired' };
    }
    return { status: 'pending', icon: Clock, color: 'text-blue-400', label: 'Pending' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
          className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Organization Settings</h2>
                <p className="text-sm text-slate-400">{userData?.organizationName}</p>
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
              <p className="text-slate-400">Loading organization data...</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-600/30">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'members'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Members ({members.length})
                  </div>
                </button>
                
                {userData?.isOrganizationCreator && (
                  <button
                    onClick={() => setActiveTab('invitations')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'invitations'
                        ? 'text-blue-400 border-b-2 border-blue-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Invitations ({invitations.length})
                    </div>
                  </button>
                )}
                
                {userData?.isOrganizationCreator && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'settings'
                        ? 'text-blue-400 border-b-2 border-blue-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Settings
                    </div>
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {/* Members Tab */}
                {activeTab === 'members' && (
                  <div className="space-y-4">
                    {members.map((member) => (
                      <div
                        key={member.uid}
                        className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">
                                {member.displayName || member.email?.split('@')[0]}
                              </span>
                              {member.isOrganizationCreator && (
                                <Crown className="w-4 h-4 text-yellow-400" />
                              )}
                            </div>
                            <p className="text-sm text-slate-400">{member.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-300 capitalize">{member.role}</div>
                          <div className="text-xs text-slate-500">
                            Joined {formatDate(member.joinedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invitations Tab */}
                {activeTab === 'invitations' && userData?.isOrganizationCreator && (
                  <div className="space-y-6">
                    {/* Send New Invitation */}
                    <div className="bg-slate-800/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white">Send New Invitation</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Email Address</label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Role</label>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as 'retailer' | 'distributor')}
                            className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
                          >
                            <option value="retailer">Retailer</option>
                            <option value="distributor">Distributor</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        onClick={sendInvitation}
                        disabled={!inviteEmail.trim() || isInviting}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isInviting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Existing Invitations */}
                    <div>
                      <h3 className="text-lg font-medium text-white mb-4">Sent Invitations</h3>
                      {invitations.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">No invitations sent yet</p>
                      ) : (
                        <div className="space-y-3">
                          {invitations.map((invitation) => {
                            const status = getInvitationStatus(invitation);
                            const StatusIcon = status.icon;
                            
                            return (
                              <div
                                key={invitation.id}
                                className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">
                                      {invitation.inviteeEmail}
                                    </span>
                                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                                    <span className={`text-xs ${status.color}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-400">
                                    Role: {invitation.role} • Sent {formatDate(invitation.createdAt?.toDate?.()?.toISOString() || new Date().toISOString())}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => copyInvitationLink(invitation.id)}
                                    className="p-2 text-slate-400 hover:text-white transition-colors"
                                    title="Copy invitation link"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  
                                  {!invitation.accepted && !invitation.cancelled && (
                                    <>
                                      <button
                                        onClick={() => handleResendInvitation(invitation.id)}
                                        className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                                        title="Resend invitation"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                      </button>
                                      
                                      <button
                                        onClick={() => handleCancelInvitation(invitation.id)}
                                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                        title="Uninvite"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                  {(invitation.cancelled || invitation.accepted) && (
                                    <button
                                      onClick={() => user && deleteInvitation(invitation.id, user.uid).then(loadInvitations)}
                                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                      title="Delete invitation"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && userData?.isOrganizationCreator && (
                  <div className="space-y-6">
                    <div className="bg-slate-800/20 rounded-xl p-4">
                      <h3 className="text-lg font-medium text-white mb-4">Organization Details</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Organization Name</label>
                          <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Location</label>
                          <input
                            type="text"
                            value={orgLocation}
                            onChange={(e) => setOrgLocation(e.target.value)}
                            className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Contact Number</label>
                          <input
                            type="tel"
                            value={orgContactNumber}
                            onChange={(e) => setOrgContactNumber(e.target.value)}
                            className="w-full p-3 bg-slate-800/40 border border-slate-600/50 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>
                      </div>
                      
                      <Button
                        onClick={updateOrganizationSettings}
                        disabled={isUpdatingOrg}
                        className="mt-4 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isUpdatingOrg ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          'Update Organization'
                        )}
                      </Button>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <h3 className="text-lg font-medium text-red-300">Danger Zone</h3>
                      </div>
                      <p className="text-sm text-red-200 mb-4">
                        These actions are permanent and cannot be undone.
                      </p>
                      <Button
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                      >
                        Delete Organization
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};