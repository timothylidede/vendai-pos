/**
 * Pezesha API Integration Layer
 * Handles credit applications, disbursements, and repayment tracking
 */

// ============================================================================
// Configuration
// ============================================================================

interface PezeshaConfig {
  apiKey: string
  apiSecret: string
  baseUrl: string
  webhookSecret: string
  environment: 'sandbox' | 'production'
}

const PEZESHA_CONFIG: PezeshaConfig = {
  apiKey: process.env.PEZESHA_API_KEY || 'sandbox_key',
  apiSecret: process.env.PEZESHA_API_SECRET || 'sandbox_secret',
  baseUrl: process.env.PEZESHA_BASE_URL || 'https://sandbox.pezesha.com/api',
  webhookSecret: process.env.PEZESHA_WEBHOOK_SECRET || 'webhook_secret',
  environment: (process.env.PEZESHA_ENV as 'sandbox' | 'production') || 'sandbox'
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface PezeshaCreditApplication {
  // Business Information
  businessName: string
  businessRegistrationNumber: string
  kraPinNumber: string
  businessEmail: string
  businessPhone: string
  businessAddress: string
  
  // Owner Information
  ownerName: string
  ownerIdNumber: string
  ownerPhone: string
  ownerEmail: string
  
  // Credit Information
  requestedAmount: number
  creditScore: number
  scoreBreakdown: {
    sales: number
    payments: number
    consistency: number
    tenure: number
    growth: number
    utilization: number
  }
  
  // Financial Metrics
  monthlySalesVolume: number
  averageOrderValue: number
  orderFrequency: number
  businessTenureDays: number
  
  // Documents (Firebase Storage URLs)
  documents: {
    kraPin?: string
    businessCertificate?: string
    ownerId?: string
    bankStatement?: string
  }
  
  // Consent Flags
  consent: {
    kyc: boolean
    crb: boolean
    dataSharing: boolean
    termsAndConditions: boolean
    autoDebit: boolean
    timestamp: string
    ipAddress: string
    signature?: string
  }
  
  // VendAI Internal
  retailerId: string
  organizationId: string
  applicationDate: string
}

export interface PezeshaApplicationResponse {
  applicationId: string
  status: 'pending' | 'approved' | 'rejected' | 'under_review'
  approvedAmount?: number
  creditLimit?: number
  interestRate?: number
  tenorDays?: number
  rejectionReason?: string
  nextReviewDate?: string
  message: string
}

export interface PezeshaDisbursement {
  applicationId: string
  retailerId: string
  amount: number
  recipientName: string
  recipientPhone: string
  recipientBankAccount?: {
    accountNumber: string
    bankCode: string
    accountName: string
  }
  purpose: string // e.g., "Supplier Payment - Order #12345"
  referenceNumber: string
  metadata?: Record<string, any>
}

export interface PezeshaDisbursementResponse {
  disbursementId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionReference?: string
  estimatedCompletionTime?: string
  message: string
}

export interface PezeshaRepayment {
  disbursementId: string
  amount: number
  paymentMethod: 'mpesa' | 'bank_transfer' | 'auto_debit'
  transactionReference: string
  paymentDate: string
  metadata?: Record<string, any>
}

export interface PezeshaWebhookPayload {
  event: 'application.approved' | 'application.rejected' | 'disbursement.completed' | 'disbursement.failed' | 'repayment.received' | 'repayment.overdue'
  timestamp: string
  data: {
    applicationId?: string
    disbursementId?: string
    repaymentId?: string
    retailerId: string
    amount?: number
    status?: string
    message?: string
    [key: string]: any
  }
  signature: string
}

export interface CreditFacility {
  id: string
  retailerId: string
  applicationId: string
  approvedAmount: number
  availableCredit: number
  outstandingBalance: number
  interestRate: number
  tenorDays: number
  approvalDate: string
  expiryDate: string
  status: 'active' | 'suspended' | 'closed' | 'defaulted'
  creditUtilization: number
}

// ============================================================================
// API Client Class
// ============================================================================

class PezeshaAPIClient {
  private config: PezeshaConfig

  constructor(config: PezeshaConfig) {
    this.config = config
  }

  /**
   * Generate authentication headers
   */
  private getHeaders(): HeadersInit {
    const timestamp = Date.now().toString()
    const signature = this.generateSignature(timestamp)
    
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    }
  }

  /**
   * Generate HMAC signature for request authentication
   */
  private generateSignature(timestamp: string): string {
    // In production, use crypto.createHmac
    // For now, basic implementation
    const message = `${this.config.apiKey}:${timestamp}`
    return Buffer.from(message).toString('base64')
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(`Pezesha API Error: ${response.status} - ${error.message || response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Pezesha API request failed:', { url, method, error })
      throw error
    }
  }

  // ============================================================================
  // Credit Application Methods
  // ============================================================================

  /**
   * Submit a credit application to Pezesha
   */
  async submitCreditApplication(
    application: PezeshaCreditApplication
  ): Promise<PezeshaApplicationResponse> {
    console.log('Submitting credit application to Pezesha:', {
      retailerId: application.retailerId,
      requestedAmount: application.requestedAmount,
      creditScore: application.creditScore
    })

    // Map VendAI application to Pezesha API format
    const pezeshaPayload = {
      business: {
        name: application.businessName,
        registration_number: application.businessRegistrationNumber,
        kra_pin: application.kraPinNumber,
        email: application.businessEmail,
        phone: application.businessPhone,
        address: application.businessAddress,
      },
      owner: {
        name: application.ownerName,
        id_number: application.ownerIdNumber,
        phone: application.ownerPhone,
        email: application.ownerEmail,
      },
      credit_request: {
        amount: application.requestedAmount,
        currency: 'KES',
        purpose: 'working_capital',
      },
      credit_score: {
        total: application.creditScore,
        breakdown: application.scoreBreakdown,
      },
      financial_metrics: {
        monthly_sales: application.monthlySalesVolume,
        average_order_value: application.averageOrderValue,
        order_frequency: application.orderFrequency,
        business_tenure_days: application.businessTenureDays,
      },
      documents: application.documents,
      consent: application.consent,
      metadata: {
        retailer_id: application.retailerId,
        organization_id: application.organizationId,
        platform: 'vendai',
        application_date: application.applicationDate,
      },
    }

    return await this.request<PezeshaApplicationResponse>(
      '/v1/credit/applications',
      'POST',
      pezeshaPayload
    )
  }

  /**
   * Check application status
   */
  async getApplicationStatus(applicationId: string): Promise<PezeshaApplicationResponse> {
    return await this.request<PezeshaApplicationResponse>(
      `/v1/credit/applications/${applicationId}`,
      'GET'
    )
  }

  // ============================================================================
  // Disbursement Methods
  // ============================================================================

  /**
   * Request disbursement to supplier
   */
  async requestDisbursement(
    disbursement: PezeshaDisbursement
  ): Promise<PezeshaDisbursementResponse> {
    console.log('Requesting disbursement from Pezesha:', {
      retailerId: disbursement.retailerId,
      amount: disbursement.amount,
      recipient: disbursement.recipientName
    })

    const payload = {
      application_id: disbursement.applicationId,
      amount: disbursement.amount,
      currency: 'KES',
      recipient: {
        name: disbursement.recipientName,
        phone: disbursement.recipientPhone,
        bank_account: disbursement.recipientBankAccount,
      },
      purpose: disbursement.purpose,
      reference: disbursement.referenceNumber,
      metadata: {
        retailer_id: disbursement.retailerId,
        ...disbursement.metadata,
      },
    }

    return await this.request<PezeshaDisbursementResponse>(
      '/v1/disbursements',
      'POST',
      payload
    )
  }

  /**
   * Check disbursement status
   */
  async getDisbursementStatus(disbursementId: string): Promise<PezeshaDisbursementResponse> {
    return await this.request<PezeshaDisbursementResponse>(
      `/v1/disbursements/${disbursementId}`,
      'GET'
    )
  }

  // ============================================================================
  // Repayment Methods
  // ============================================================================

  /**
   * Record a manual repayment
   */
  async recordRepayment(repayment: PezeshaRepayment): Promise<{ success: boolean; message: string }> {
    console.log('Recording repayment with Pezesha:', {
      disbursementId: repayment.disbursementId,
      amount: repayment.amount,
      method: repayment.paymentMethod
    })

    const payload = {
      disbursement_id: repayment.disbursementId,
      amount: repayment.amount,
      currency: 'KES',
      payment_method: repayment.paymentMethod,
      transaction_reference: repayment.transactionReference,
      payment_date: repayment.paymentDate,
      metadata: repayment.metadata,
    }

    return await this.request<{ success: boolean; message: string }>(
      '/v1/repayments',
      'POST',
      payload
    )
  }

  /**
   * Get outstanding balance for a retailer
   */
  async getOutstandingBalance(retailerId: string): Promise<{
    totalOutstanding: number
    activeDisbursements: Array<{
      disbursementId: string
      amount: number
      amountPaid: number
      amountOutstanding: number
      dueDate: string
      status: string
    }>
  }> {
    return await this.request<any>(
      `/v1/retailers/${retailerId}/balance`,
      'GET'
    )
  }

  // ============================================================================
  // Webhook Verification
  // ============================================================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = Buffer.from(
      `${this.config.webhookSecret}:${payload}`
    ).toString('base64')
    
    return signature === expectedSignature
  }

  /**
   * Parse and validate webhook payload
   */
  parseWebhook(rawPayload: string, signature: string): PezeshaWebhookPayload | null {
    if (!this.verifyWebhookSignature(rawPayload, signature)) {
      console.error('Invalid webhook signature')
      return null
    }

    try {
      return JSON.parse(rawPayload) as PezeshaWebhookPayload
    } catch (error) {
      console.error('Failed to parse webhook payload:', error)
      return null
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const pezeshaClient = new PezeshaAPIClient(PEZESHA_CONFIG)

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate available credit for a retailer
 */
export function calculateAvailableCredit(facility: CreditFacility): number {
  return Math.max(0, facility.approvedAmount - facility.outstandingBalance)
}

/**
 * Check if retailer has sufficient credit for an order
 */
export function hasAvailableCredit(facility: CreditFacility, orderAmount: number): boolean {
  const available = calculateAvailableCredit(facility)
  return available >= orderAmount && facility.status === 'active'
}

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(facility: CreditFacility): number {
  if (facility.approvedAmount === 0) return 0
  return (facility.outstandingBalance / facility.approvedAmount) * 100
}

/**
 * Generate unique reference number for disbursement
 */
export function generateDisbursementReference(retailerId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `VND-${retailerId.substring(0, 6).toUpperCase()}-${timestamp}-${random}`
}

/**
 * Check if payment is overdue
 */
export function isPaymentOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date()
}

/**
 * Calculate days overdue
 */
export function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffTime = now.getTime() - due.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// Types are already exported with 'export interface' above, no need to re-export
