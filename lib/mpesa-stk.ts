/**
 * M-Pesa STK Push Integration
 * Handles Safaricom M-Pesa STK (Sim Toolkit) push for credit repayments
 */

import axios from 'axios'

// M-Pesa API Configuration
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE || '',
  passkey: process.env.MPESA_PASSKEY || '',
  callbackUrl: process.env.MPESA_CALLBACK_URL || '',
  environment: process.env.MPESA_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
}

// M-Pesa API Endpoints
const MPESA_ENDPOINTS = {
  sandbox: {
    oauth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  },
  production: {
    oauth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  },
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface MpesaSTKPushRequest {
  phoneNumber: string // Format: 254XXXXXXXXX
  amount: number
  accountReference: string // e.g., "REPAY-123"
  transactionDesc: string // e.g., "Credit Repayment"
}

export interface MpesaSTKPushResponse {
  success: boolean
  merchantRequestID?: string
  checkoutRequestID?: string
  responseCode?: string
  responseDescription?: string
  customerMessage?: string
  error?: string
}

export interface MpesaSTKQueryResponse {
  success: boolean
  resultCode?: string
  resultDesc?: string
  merchantRequestID?: string
  checkoutRequestID?: string
  error?: string
}

export interface MpesaCallbackData {
  merchantRequestID: string
  checkoutRequestID: string
  resultCode: number
  resultDesc: string
  amount?: number
  mpesaReceiptNumber?: string
  transactionDate?: string
  phoneNumber?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate OAuth access token for M-Pesa API
 */
async function getAccessToken(): Promise<string> {
  const env = MPESA_CONFIG.environment as 'sandbox' | 'production'
  const authUrl = MPESA_ENDPOINTS[env].oauth

  const credentials = Buffer.from(
    `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
  ).toString('base64')

  try {
    const response = await axios.get(authUrl, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    })

    return response.data.access_token
  } catch (error) {
    console.error('Error getting M-Pesa access token:', error)
    throw new Error('Failed to authenticate with M-Pesa API')
  }
}

/**
 * Generate M-Pesa password (Base64 encoded shortcode + passkey + timestamp)
 */
function generatePassword(timestamp: string): string {
  const passwordString = `${MPESA_CONFIG.businessShortCode}${MPESA_CONFIG.passkey}${timestamp}`
  return Buffer.from(passwordString).toString('base64')
}

/**
 * Generate timestamp in M-Pesa format (YYYYMMDDHHmmss)
 */
function generateTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '')

  // Handle different formats
  if (cleaned.startsWith('0')) {
    // 0712345678 → 254712345678
    cleaned = '254' + cleaned.substring(1)
  } else if (cleaned.startsWith('254')) {
    // Already in correct format
    return cleaned
  } else if (cleaned.startsWith('+254')) {
    // +254712345678 → 254712345678
    cleaned = cleaned.substring(1)
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    // 712345678 → 254712345678
    cleaned = '254' + cleaned
  }

  // Validate format
  if (!cleaned.match(/^254[71]\d{8}$/)) {
    throw new Error('Invalid Kenyan phone number format')
  }

  return cleaned
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Initiate M-Pesa STK push for credit repayment
 */
export async function initiateSTKPush(
  request: MpesaSTKPushRequest
): Promise<MpesaSTKPushResponse> {
  try {
    // Validate configuration
    if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret) {
      throw new Error('M-Pesa API credentials not configured')
    }

    if (!MPESA_CONFIG.businessShortCode || !MPESA_CONFIG.passkey) {
      throw new Error('M-Pesa business configuration missing')
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(request.phoneNumber)

    // Get access token
    const accessToken = await getAccessToken()

    // Generate timestamp and password
    const timestamp = generateTimestamp()
    const password = generatePassword(timestamp)

    // Prepare STK push payload
    const env = MPESA_CONFIG.environment as 'sandbox' | 'production'
    const stkPushUrl = MPESA_ENDPOINTS[env].stkPush

    const payload = {
      BusinessShortCode: MPESA_CONFIG.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(request.amount), // M-Pesa requires integer
      PartyA: formattedPhone, // Phone number sending money
      PartyB: MPESA_CONFIG.businessShortCode, // Organization receiving funds
      PhoneNumber: formattedPhone, // Phone number to receive STK push
      CallBackURL: MPESA_CONFIG.callbackUrl,
      AccountReference: request.accountReference,
      TransactionDesc: request.transactionDesc,
    }

    console.log('Initiating M-Pesa STK push:', {
      phone: formattedPhone,
      amount: request.amount,
      reference: request.accountReference,
    })

    const response = await axios.post(stkPushUrl, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    // Success response
    if (response.data.ResponseCode === '0') {
      return {
        success: true,
        merchantRequestID: response.data.MerchantRequestID,
        checkoutRequestID: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      }
    } else {
      // M-Pesa returned error
      return {
        success: false,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        error: response.data.errorMessage || 'STK push failed',
      }
    }
  } catch (error: any) {
    console.error('Error initiating M-Pesa STK push:', error)
    return {
      success: false,
      error: error.response?.data?.errorMessage || error.message || 'STK push request failed',
    }
  }
}

/**
 * Query M-Pesa STK push transaction status
 */
export async function querySTKPushStatus(
  checkoutRequestID: string
): Promise<MpesaSTKQueryResponse> {
  try {
    // Get access token
    const accessToken = await getAccessToken()

    // Generate timestamp and password
    const timestamp = generateTimestamp()
    const password = generatePassword(timestamp)

    // Prepare query payload
    const env = MPESA_CONFIG.environment as 'sandbox' | 'production'
    const queryUrl = MPESA_ENDPOINTS[env].stkQuery

    const payload = {
      BusinessShortCode: MPESA_CONFIG.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    }

    const response = await axios.post(queryUrl, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    // Parse result
    const resultCode = response.data.ResultCode

    return {
      success: resultCode === '0',
      resultCode: response.data.ResultCode,
      resultDesc: response.data.ResultDesc,
      merchantRequestID: response.data.MerchantRequestID,
      checkoutRequestID: response.data.CheckoutRequestID,
    }
  } catch (error: any) {
    console.error('Error querying M-Pesa STK status:', error)
    return {
      success: false,
      error: error.response?.data?.errorMessage || error.message || 'Query failed',
    }
  }
}

/**
 * Parse M-Pesa callback data from webhook
 */
export function parseMpesaCallback(callbackBody: any): MpesaCallbackData {
  const body = callbackBody.Body?.stkCallback || {}

  const data: MpesaCallbackData = {
    merchantRequestID: body.MerchantRequestID || '',
    checkoutRequestID: body.CheckoutRequestID || '',
    resultCode: body.ResultCode || -1,
    resultDesc: body.ResultDesc || '',
  }

  // Parse metadata if payment was successful
  if (body.ResultCode === 0 && body.CallbackMetadata?.Item) {
    const items = body.CallbackMetadata.Item

    items.forEach((item: any) => {
      switch (item.Name) {
        case 'Amount':
          data.amount = item.Value
          break
        case 'MpesaReceiptNumber':
          data.mpesaReceiptNumber = item.Value
          break
        case 'TransactionDate':
          data.transactionDate = item.Value
          break
        case 'PhoneNumber':
          data.phoneNumber = item.Value
          break
      }
    })
  }

  return data
}

/**
 * Validate M-Pesa configuration
 */
export function validateMpesaConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!MPESA_CONFIG.consumerKey) {
    errors.push('MPESA_CONSUMER_KEY not configured')
  }
  if (!MPESA_CONFIG.consumerSecret) {
    errors.push('MPESA_CONSUMER_SECRET not configured')
  }
  if (!MPESA_CONFIG.businessShortCode) {
    errors.push('MPESA_BUSINESS_SHORTCODE not configured')
  }
  if (!MPESA_CONFIG.passkey) {
    errors.push('MPESA_PASSKEY not configured')
  }
  if (!MPESA_CONFIG.callbackUrl) {
    errors.push('MPESA_CALLBACK_URL not configured')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// Test/Development Helpers
// ============================================================================

/**
 * Test M-Pesa configuration (sandbox only)
 */
export async function testMpesaConnection(): Promise<{
  success: boolean
  message: string
}> {
  if (MPESA_CONFIG.environment !== 'sandbox') {
    return {
      success: false,
      message: 'Test connection only available in sandbox mode',
    }
  }

  try {
    const accessToken = await getAccessToken()
    return {
      success: true,
      message: 'Successfully connected to M-Pesa API',
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
    }
  }
}
