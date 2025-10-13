/**
 * Credit Operations Library
 * Provides utility functions for credit availability checks, facility lookups, and alerts
 */

import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface CreditFacility {
  id: string
  facilityId: string
  retailerId: string
  organizationId: string
  applicationId: string
  approvedAmount: number
  currency: 'KES'
  interestRate: number
  tenorDays: number
  totalDisbursed: number
  totalRepaid: number
  outstandingBalance: number
  availableCredit: number
  creditUtilization: number
  status: 'active' | 'suspended' | 'closed' | 'defaulted' | 'expired'
  activatedAt: Timestamp
  expiryDate: Timestamp | Date
  lastDisbursementAt: Timestamp | null
  lastRepaymentAt: Timestamp | null
  pezeshaFacilityId: string
  pezeshaStatus: string
  limitHistory: Array<{
    previousLimit: number
    newLimit: number
    reason: string
    changedAt: Timestamp
    changedBy: string
  }>
  metrics: {
    totalDisbursements: number
    successfulRepayments: number
    lateRepayments: number
    averageRepaymentLagDays: number
    currentStreak: number
    longestStreak: number
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CreditAvailability {
  hasCredit: boolean
  hasSufficientCredit: boolean
  availableCredit: number
  creditLimit: number
  outstandingBalance: number
  creditUtilization: number
  message: string
  facility: CreditFacility | null
}

export interface CreditAlert {
  level: 'info' | 'warning' | 'danger'
  title: string
  message: string
  action?: string
  actionUrl?: string
}

// ============================================================================
// Credit Facility Functions
// ============================================================================

/**
 * Get active credit facility for a retailer
 */
export async function getCreditFacility(
  retailerId: string,
  organizationId: string
): Promise<CreditFacility | null> {
  if (!db) {
    console.error('Firestore not initialized')
    return null
  }

  try {
    const facilitiesRef = collection(db, 'organizations', organizationId, 'credit_facilities')
    const q = query(
      facilitiesRef,
      where('retailerId', '==', retailerId),
      where('status', '==', 'active'),
      limit(1)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data(),
    } as CreditFacility
  } catch (error) {
    console.error('Error fetching credit facility:', error)
    return null
  }
}

/**
 * Check if retailer has sufficient credit for a requested amount
 */
export async function checkCreditAvailability(
  retailerId: string,
  organizationId: string,
  requestedAmount: number
): Promise<CreditAvailability> {
  const facility = await getCreditFacility(retailerId, organizationId)

  if (!facility) {
    return {
      hasCredit: false,
      hasSufficientCredit: false,
      availableCredit: 0,
      creditLimit: 0,
      outstandingBalance: 0,
      creditUtilization: 0,
      message: 'No active credit facility found. Apply for credit to get started.',
      facility: null,
    }
  }

  const available = facility.approvedAmount - facility.outstandingBalance
  const utilization = (facility.outstandingBalance / facility.approvedAmount) * 100

  if (requestedAmount > available) {
    return {
      hasCredit: true,
      hasSufficientCredit: false,
      availableCredit: available,
      creditLimit: facility.approvedAmount,
      outstandingBalance: facility.outstandingBalance,
      creditUtilization: utilization,
      message: `Insufficient credit. You need ${formatCurrency(requestedAmount)} but have ${formatCurrency(available)} available.`,
      facility,
    }
  }

  return {
    hasCredit: true,
    hasSufficientCredit: true,
    availableCredit: available,
    creditLimit: facility.approvedAmount,
    outstandingBalance: facility.outstandingBalance,
    creditUtilization: utilization,
    message: 'Credit available for this order',
    facility,
  }
}

/**
 * Generate credit alerts for a facility
 */
export function getCreditAlerts(facility: CreditFacility): CreditAlert[] {
  const alerts: CreditAlert[] = []
  const utilization = (facility.outstandingBalance / facility.approvedAmount) * 100

  // High utilization warning (>85%)
  if (utilization > 85) {
    alerts.push({
      level: 'danger',
      title: 'High Credit Utilization',
      message: `You're using ${utilization.toFixed(0)}% of your credit limit. Make a payment to avoid reaching your limit.`,
      action: 'Make Payment',
      actionUrl: '/retailer/credit/repayments',
    })
  } else if (utilization > 70) {
    alerts.push({
      level: 'warning',
      title: 'Credit Utilization Alert',
      message: `You're using ${utilization.toFixed(0)}% of your credit limit. Consider planning a payment soon.`,
    })
  }

  // Overdue payments check
  if (facility.metrics.lateRepayments > 0) {
    alerts.push({
      level: 'danger',
      title: 'Overdue Payment',
      message: 'You have overdue payments. Please settle them to maintain your credit score.',
      action: 'View Schedule',
      actionUrl: '/retailer/credit/repayments',
    })
  }

  // Facility expiring soon (within 30 days)
  const expiryDate = facility.expiryDate instanceof Timestamp 
    ? facility.expiryDate.toDate() 
    : new Date(facility.expiryDate)
  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
    alerts.push({
      level: 'warning',
      title: 'Credit Facility Expiring Soon',
      message: `Your credit facility expires in ${daysUntilExpiry} days. Contact support to renew.`,
      action: 'Renew Facility',
      actionUrl: '/support',
    })
  }

  // Limit increase eligibility
  if (
    facility.metrics.successfulRepayments >= 6 &&
    facility.metrics.currentStreak >= 6 &&
    utilization < 50 &&
    facility.metrics.lateRepayments === 0
  ) {
    alerts.push({
      level: 'info',
      title: 'Eligible for Limit Increase',
      message: 'Your payment history qualifies you for a credit limit increase!',
      action: 'Request Increase',
      actionUrl: '/retailer/credit/increase',
    })
  }

  // Low credit availability warning (<20%)
  const availableCredit = facility.approvedAmount - facility.outstandingBalance
  const availabilityPercentage = (availableCredit / facility.approvedAmount) * 100

  if (availabilityPercentage < 20 && availabilityPercentage > 0) {
    alerts.push({
      level: 'warning',
      title: 'Low Available Credit',
      message: `Only ${formatCurrency(availableCredit)} (${availabilityPercentage.toFixed(0)}%) of your credit limit is available.`,
      action: 'Make Payment',
      actionUrl: '/retailer/credit/repayments',
    })
  }

  // Perfect payment streak recognition
  if (facility.metrics.currentStreak >= 12) {
    alerts.push({
      level: 'info',
      title: 'Excellent Payment History!',
      message: `${facility.metrics.currentStreak} consecutive on-time payments. Keep up the great work!`,
    })
  }

  return alerts
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency in KES
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Calculate available credit
 */
export function calculateAvailableCredit(facility: CreditFacility): number {
  return Math.max(0, facility.approvedAmount - facility.outstandingBalance)
}

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(facility: CreditFacility): number {
  if (facility.approvedAmount === 0) return 0
  return (facility.outstandingBalance / facility.approvedAmount) * 100
}

/**
 * Check if facility is expired
 */
export function isFacilityExpired(facility: CreditFacility): boolean {
  const expiryDate = facility.expiryDate instanceof Timestamp 
    ? facility.expiryDate.toDate() 
    : new Date(facility.expiryDate)
  return expiryDate < new Date()
}

/**
 * Check if facility is approaching expiry (within 30 days)
 */
export function isFacilityExpiringSoon(facility: CreditFacility): boolean {
  const expiryDate = facility.expiryDate instanceof Timestamp 
    ? facility.expiryDate.toDate() 
    : new Date(facility.expiryDate)
  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0
}

/**
 * Get facility status badge color
 */
export function getFacilityStatusColor(status: CreditFacility['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'suspended':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'defaulted':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'closed':
    case 'expired':
      return 'bg-gray-100 text-gray-800 border-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

/**
 * Get utilization badge color
 */
export function getUtilizationColor(utilization: number): string {
  if (utilization > 85) return 'bg-red-500'
  if (utilization > 70) return 'bg-yellow-500'
  if (utilization > 50) return 'bg-blue-500'
  return 'bg-green-500'
}
