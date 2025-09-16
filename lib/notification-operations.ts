import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface NotificationData {
  type: 'invitation_received' | 'invitation_accepted' | 'member_joined' | 'organization_update' | 'system';
  title: string;
  message: string;
  userId: string;
  organizationName?: string;
  actionUrl?: string;
  metadata?: {
    invitationId?: string;
    inviterName?: string;
    memberName?: string;
    memberEmail?: string;
  };
  read: boolean;
  createdAt: any;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (notificationData: Omit<NotificationData, 'read' | 'createdAt'>) => {
  try {
    const notification: NotificationData = {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'notifications'), notification);
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: 'Failed to create notification' };
  }
};

/**
 * Send invitation received notification
 */
export const notifyInvitationReceived = async (
  inviteeEmail: string,
  inviterName: string,
  organizationName: string,
  invitationId: string
) => {
  try {
    // Find user by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', inviteeEmail)
    );
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      // User not found, they'll see the invitation when they sign up
      return { success: true };
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;

    await createNotification({
      type: 'invitation_received',
      title: 'Organization Invitation',
      message: `${inviterName} invited you to join ${organizationName}`,
      userId: userId,
      organizationName: organizationName,
      actionUrl: `/onboarding?invite=${invitationId}`,
      metadata: {
        invitationId,
        inviterName
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending invitation notification:', error);
    return { success: false, error: 'Failed to send notification' };
  }
};

/**
 * Send invitation accepted notification to organization creator
 */
export const notifyInvitationAccepted = async (
  inviterUid: string,
  memberName: string,
  memberEmail: string,
  organizationName: string
) => {
  try {
    await createNotification({
      type: 'invitation_accepted',
      title: 'Invitation Accepted',
      message: `${memberName || memberEmail} has joined ${organizationName}`,
      userId: inviterUid,
      organizationName: organizationName,
      actionUrl: '/modules', // Could be organization settings page
      metadata: {
        memberName,
        memberEmail
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending acceptance notification:', error);
    return { success: false, error: 'Failed to send notification' };
  }
};

/**
 * Send member joined notification to all organization members
 */
export const notifyMemberJoined = async (
  organizationName: string,
  newMemberName: string,
  newMemberEmail: string,
  excludeUserId?: string
) => {
  try {
    // Find all users in the organization
    const organizationMembersQuery = query(
      collection(db, 'users'),
      where('organizationName', '==', organizationName)
    );
    const membersSnapshot = await getDocs(organizationMembersQuery);

    const notifications = membersSnapshot.docs
      .filter(doc => doc.id !== excludeUserId) // Don't notify the new member
      .map(doc => 
        createNotification({
          type: 'member_joined',
          title: 'New Member Joined',
          message: `${newMemberName || newMemberEmail} joined ${organizationName}`,
          userId: doc.id,
          organizationName: organizationName,
          actionUrl: '/modules',
          metadata: {
            memberName: newMemberName,
            memberEmail: newMemberEmail
          }
        })
      );

    await Promise.all(notifications);
    return { success: true };
  } catch (error) {
    console.error('Error sending member joined notifications:', error);
    return { success: false, error: 'Failed to send notifications' };
  }
};

/**
 * Send organization update notification to all members
 */
export const notifyOrganizationUpdate = async (
  organizationName: string,
  updateMessage: string,
  excludeUserId?: string
) => {
  try {
    // Find all users in the organization
    const organizationMembersQuery = query(
      collection(db, 'users'),
      where('organizationName', '==', organizationName)
    );
    const membersSnapshot = await getDocs(organizationMembersQuery);

    const notifications = membersSnapshot.docs
      .filter(doc => doc.id !== excludeUserId) // Don't notify the person making the update
      .map(doc => 
        createNotification({
          type: 'organization_update',
          title: 'Organization Update',
          message: updateMessage,
          userId: doc.id,
          organizationName: organizationName,
          actionUrl: '/modules'
        })
      );

    await Promise.all(notifications);
    return { success: true };
  } catch (error) {
    console.error('Error sending organization update notifications:', error);
    return { success: false, error: 'Failed to send notifications' };
  }
};

/**
 * Send system notification to a user
 */
export const notifySystem = async (
  userId: string,
  title: string,
  message: string,
  actionUrl?: string
) => {
  try {
    await createNotification({
      type: 'system',
      title,
      message,
      userId,
      actionUrl
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending system notification:', error);
    return { success: false, error: 'Failed to send notification' };
  }
};

/**
 * Get notification count for a user
 */
export const getNotificationCount = async (userId: string) => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(notificationsQuery);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Error getting notification count:', error);
    return { success: false, count: 0 };
  }
};