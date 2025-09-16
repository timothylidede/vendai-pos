import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  deleteDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notifyInvitationReceived } from '@/lib/notification-operations';

export interface InvitationData {
  organizationName: string;
  role: 'retailer' | 'distributor';
  inviterName: string;
  inviterEmail: string;
  inviterUid: string;
  inviteeEmail: string;
  organizationLocation?: string;
  organizationCoordinates?: { lat: number; lng: number };
  message?: string;
  accepted?: boolean;
  cancelled?: boolean;
  createdAt?: any;
  expiresAt?: Date;
  acceptedBy?: string;
  acceptedAt?: any;
  cancelledAt?: any;
  resendCount?: number;
  lastSentAt?: any;
}

export interface CreateInvitationRequest {
  inviteeEmail: string;
  role?: 'retailer' | 'distributor';
  message?: string;
}

/**
 * Create and send an invitation to join an organization
 */
export const createInvitation = async (
  inviterUid: string,
  invitationRequest: CreateInvitationRequest
): Promise<{ success: boolean; invitationId?: string; invitationLink?: string; error?: string }> => {
  try {
    // Get inviter's data
    const inviterDoc = await getDoc(doc(db, 'users', inviterUid));
    if (!inviterDoc.exists()) {
      return { success: false, error: 'Inviter not found' };
    }

    const inviterData = inviterDoc.data();
    if (!inviterData.isOrganizationCreator) {
      return { success: false, error: 'Only organization creators can send invitations' };
    }

    // Check if invitation already exists
    const existingInvitationsQuery = query(
      collection(db, 'invitations'),
      where('inviteeEmail', '==', invitationRequest.inviteeEmail),
      where('organizationName', '==', inviterData.organizationName),
      where('accepted', '==', false),
      where('cancelled', '==', false)
    );
    const existingInvitations = await getDocs(existingInvitationsQuery);

    if (!existingInvitations.empty) {
      return { success: false, error: 'Active invitation already exists for this email' };
    }

    // Create invitation
    const invitation: InvitationData = {
      organizationName: inviterData.organizationName,
      role: invitationRequest.role || inviterData.role,
      inviterName: inviterData.displayName || inviterData.email?.split('@')[0] || 'Organization Admin',
      inviterEmail: inviterData.email,
      inviterUid: inviterUid,
      inviteeEmail: invitationRequest.inviteeEmail,
      organizationLocation: inviterData.location,
      organizationCoordinates: inviterData.coordinates,
      message: invitationRequest.message || '',
      accepted: false,
      cancelled: false,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      resendCount: 0
    };

    const invitationRef = await addDoc(collection(db, 'invitations'), invitation);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const invitationLink = `${baseUrl}/onboarding?invite=${invitationRef.id}`;

    // Send notification to invitee if they're already registered
    await notifyInvitationReceived(
      invitationRequest.inviteeEmail,
      invitation.inviterName,
      invitation.organizationName,
      invitationRef.id
    );

    return {
      success: true,
      invitationId: invitationRef.id,
      invitationLink
    };

  } catch (error) {
    console.error('Error creating invitation:', error);
    return { success: false, error: 'Failed to create invitation' };
  }
};

/**
 * Get invitation by ID
 */
export const getInvitation = async (
  invitationId: string
): Promise<{ success: boolean; invitation?: InvitationData & { id: string }; error?: string }> => {
  try {
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    
    if (!invitationDoc.exists()) {
      return { success: false, error: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data() as InvitationData;
    
    // Check if expired
    if (invitationData.expiresAt && invitationData.expiresAt < new Date()) {
      return { success: false, error: 'Invitation has expired' };
    }

    // Check if already accepted
    if (invitationData.accepted) {
      return { success: false, error: 'Invitation has already been accepted' };
    }

    // Check if cancelled
    if (invitationData.cancelled) {
      return { success: false, error: 'Invitation has been cancelled' };
    }

    return {
      success: true,
      invitation: { id: invitationDoc.id, ...invitationData }
    };

  } catch (error) {
    console.error('Error getting invitation:', error);
    return { success: false, error: 'Failed to retrieve invitation' };
  }
};

/**
 * Get all invitations sent by a user
 */
export const getUserInvitations = async (
  userUid: string
): Promise<{ success: boolean; invitations?: (InvitationData & { id: string })[]; error?: string }> => {
  try {
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('inviterUid', '==', userUid)
    );
    const invitationsSnapshot = await getDocs(invitationsQuery);

    const invitations = invitationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (InvitationData & { id: string })[];

    return { success: true, invitations };

  } catch (error) {
    console.error('Error getting user invitations:', error);
    return { success: false, error: 'Failed to retrieve invitations' };
  }
};

/**
 * Cancel an invitation
 */
export const cancelInvitation = async (
  invitationId: string,
  userUid: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    const invitationDoc = await getDoc(invitationRef);

    if (!invitationDoc.exists()) {
      return { success: false, error: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data() as InvitationData;
    if (invitationData.inviterUid !== userUid) {
      return { success: false, error: 'Unauthorized to cancel this invitation' };
    }

    await updateDoc(invitationRef, {
      cancelled: true,
      cancelledAt: serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return { success: false, error: 'Failed to cancel invitation' };
  }
};

/**
 * Resend an invitation (extend expiry)
 */
export const resendInvitation = async (
  invitationId: string,
  userUid: string
): Promise<{ success: boolean; invitationLink?: string; error?: string }> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    const invitationDoc = await getDoc(invitationRef);

    if (!invitationDoc.exists()) {
      return { success: false, error: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data() as InvitationData;
    if (invitationData.inviterUid !== userUid) {
      return { success: false, error: 'Unauthorized to resend this invitation' };
    }

    await updateDoc(invitationRef, {
      resendCount: (invitationData.resendCount || 0) + 1,
      lastSentAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Extend by 7 days
    });

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const invitationLink = `${baseUrl}/onboarding?invite=${invitationId}`;

    return { success: true, invitationLink };

  } catch (error) {
    console.error('Error resending invitation:', error);
    return { success: false, error: 'Failed to resend invitation' };
  }
};

/**
 * Accept an invitation (called from onboarding)
 */
export const acceptInvitation = async (
  invitationId: string,
  userUid: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    
    await updateDoc(invitationRef, {
      accepted: true,
      acceptedBy: userUid,
      acceptedAt: serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, error: 'Failed to accept invitation' };
  }
};

/**
 * Delete an invitation permanently
 */
export const deleteInvitation = async (
  invitationId: string,
  userUid: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    const invitationDoc = await getDoc(invitationRef);

    if (!invitationDoc.exists()) {
      return { success: false, error: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data() as InvitationData;
    if (invitationData.inviterUid !== userUid) {
      return { success: false, error: 'Unauthorized to delete this invitation' };
    }

    await deleteDoc(invitationRef);

    return { success: true };

  } catch (error) {
    console.error('Error deleting invitation:', error);
    return { success: false, error: 'Failed to delete invitation' };
  }
};