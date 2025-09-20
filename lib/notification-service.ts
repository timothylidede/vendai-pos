import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  updateDoc,
  deleteDoc,
  doc 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import logger from '@/lib/logger'

export type NotificationType = 
  | 'order_received' 
  | 'order_confirmed' 
  | 'order_delivered' 
  | 'payment_due' 
  | 'stock_alert' 
  | 'settlement_due'
  | 'invoice_generated'
  | 'system_alert'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface CreateNotificationData {
  userId: string
  type: NotificationType
  title: string
  message: string
  priority?: NotificationPriority
  actionUrl?: string
  metadata?: Record<string, any>
  expiresIn?: number // Hours until notification expires
}

export class NotificationService {
  private static instance: NotificationService
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  async createNotification(data: CreateNotificationData): Promise<string> {
    try {
      const expiresAt = data.expiresIn 
        ? new Date(Date.now() + data.expiresIn * 60 * 60 * 1000)
        : null

      const notificationDoc = {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || 'medium',
        actionUrl: data.actionUrl,
        metadata: data.metadata || {},
        read: false,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt ? expiresAt : null
      }

      const docRef = await addDoc(collection(db, 'notifications'), notificationDoc)
      
      logger.info('Notification created', {
        notificationId: docRef.id,
        userId: data.userId,
        type: data.type,
        priority: data.priority
      })

      // In production, trigger push notification here
      await this.triggerPushNotification(data)

      return docRef.id
    } catch (error) {
      logger.error('Failed to create notification', error, data)
      throw error
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId)
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      })

      logger.info('Notification marked as read', { notificationId })
    } catch (error) {
      logger.error('Failed to mark notification as read', error, { notificationId })
      throw error
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      )

      const snapshot = await getDocs(q)
      const batch = db.batch ? db.batch() : null // Fallback for environments without batch

      if (batch) {
        snapshot.forEach((doc) => {
          batch.update(doc.ref, {
            read: true,
            readAt: serverTimestamp()
          })
        })
        await batch.commit()
      } else {
        // Fallback to individual updates
        await Promise.all(
          snapshot.docs.map(doc => 
            updateDoc(doc.ref, {
              read: true,
              readAt: serverTimestamp()
            })
          )
        )
      }

      logger.info('All notifications marked as read', { userId, count: snapshot.size })
    } catch (error) {
      logger.error('Failed to mark all notifications as read', error, { userId })
      throw error
    }
  }

  // Business-specific notification creators
  async notifyOrderReceived(distributorId: string, order: any): Promise<void> {
    await this.createNotification({
      userId: distributorId,
      type: 'order_received',
      title: 'New Order Received',
      message: `Order #${order.id} from ${order.retailerName} - KSh ${order.total?.toLocaleString()}`,
      priority: 'high',
      actionUrl: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        retailerId: order.retailerId,
        amount: order.total
      },
      expiresIn: 72 // 3 days
    })
  }

  async notifyOrderConfirmed(retailerId: string, order: any): Promise<void> {
    await this.createNotification({
      userId: retailerId,
      type: 'order_confirmed',
      title: 'Order Confirmed',
      message: `Your order #${order.id} has been confirmed and is being prepared`,
      priority: 'medium',
      actionUrl: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        distributorId: order.distributorId
      },
      expiresIn: 168 // 1 week
    })
  }

  async notifyLowStock(userId: string, product: any, currentStock: number): Promise<void> {
    await this.createNotification({
      userId: userId,
      type: 'stock_alert',
      title: 'Low Stock Alert',
      message: `${product.name} is running low - only ${currentStock} units remaining`,
      priority: 'high',
      actionUrl: `/inventory/${product.id}`,
      metadata: {
        productId: product.id,
        currentStock,
        reorderLevel: product.reorderLevel
      },
      expiresIn: 24 // 1 day
    })
  }

  async notifySettlementDue(distributorId: string, settlement: any): Promise<void> {
    await this.createNotification({
      userId: distributorId,
      type: 'settlement_due',
      title: 'Settlement Payment Due',
      message: `Settlement for ${settlement.month} is due - KSh ${settlement.settlement?.toLocaleString()}`,
      priority: 'urgent',
      actionUrl: `/settlements/${settlement.id}`,
      metadata: {
        settlementId: settlement.id,
        amount: settlement.settlement,
        month: settlement.month,
        dueDate: settlement.dueDate
      },
      expiresIn: 720 // 30 days
    })
  }

  async notifyInvoiceGenerated(retailerId: string, invoice: any): Promise<void> {
    await this.createNotification({
      userId: retailerId,
      type: 'invoice_generated',
      title: 'New Invoice Generated',
      message: `Invoice #${invoice.invoiceNumber} for KSh ${invoice.total?.toLocaleString()} is ready`,
      priority: 'medium',
      actionUrl: `/invoices/${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total
      },
      expiresIn: 720 // 30 days
    })
  }

  async notifyPaymentOverdue(userId: string, invoice: any): Promise<void> {
    await this.createNotification({
      userId: userId,
      type: 'payment_due',
      title: 'Payment Overdue',
      message: `Payment for invoice #${invoice.invoiceNumber} is overdue - KSh ${invoice.total?.toLocaleString()}`,
      priority: 'urgent',
      actionUrl: `/invoices/${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        dueDate: invoice.dueDate
      },
      expiresIn: 168 // 1 week
    })
  }

  async notifySystemAlert(userId: string, title: string, message: string, priority: NotificationPriority = 'medium'): Promise<void> {
    await this.createNotification({
      userId: userId,
      type: 'system_alert',
      title: title,
      message: message,
      priority: priority,
      expiresIn: 48 // 2 days
    })
  }

  private async triggerPushNotification(data: CreateNotificationData): Promise<void> {
    try {
      // In production, integrate with Firebase Cloud Messaging (FCM)
      // For now, we'll log the notification
      logger.info('Push notification triggered', {
        userId: data.userId,
        title: data.title,
        message: data.message,
        priority: data.priority
      })

      // Example FCM implementation:
      /*
      const message = {
        notification: {
          title: data.title,
          body: data.message
        },
        data: {
          type: data.type,
          actionUrl: data.actionUrl || '',
          priority: data.priority || 'medium'
        },
        token: userFCMToken // Get from user preferences
      }
      
      await admin.messaging().send(message)
      */
    } catch (error) {
      logger.error('Push notification failed', error)
      // Don't throw - notification was created successfully
    }
  }

  // Cleanup expired notifications
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const now = new Date()
      const q = query(
        collection(db, 'notifications'),
        where('expiresAt', '<=', now)
      )

      const snapshot = await getDocs(q)
      const batch = db.batch ? db.batch() : null

      if (batch) {
        snapshot.forEach((doc) => {
          batch.delete(doc.ref)
        })
        await batch.commit()
      } else {
        // Fallback to individual deletions
        await Promise.all(
          snapshot.docs.map(doc => deleteDoc(doc.ref))
        )
      }

      const deletedCount = snapshot.size
      logger.info('Expired notifications cleaned up', { count: deletedCount })
      
      return deletedCount
    } catch (error) {
      logger.error('Failed to cleanup expired notifications', error)
      return 0
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance()

// Helper functions for common operations
export const createOrderNotification = (distributorId: string, order: any) =>
  notificationService.notifyOrderReceived(distributorId, order)

export const createStockAlert = (userId: string, product: any, currentStock: number) =>
  notificationService.notifyLowStock(userId, product, currentStock)

export const createSettlementAlert = (distributorId: string, settlement: any) =>
  notificationService.notifySettlementDue(distributorId, settlement)

export const createInvoiceNotification = (retailerId: string, invoice: any) =>
  notificationService.notifyInvoiceGenerated(retailerId, invoice)

export const createPaymentAlert = (userId: string, invoice: any) =>
  notificationService.notifyPaymentOverdue(userId, invoice)