/**
 * M-Pesa Callback Handler
 * Receives payment confirmations from Safaricom M-Pesa
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleMpesaCallback } from '../repay/route'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('M-Pesa callback received:', JSON.stringify(body, null, 2))

    // Process the callback
    const result = await handleMpesaCallback(body)

    // M-Pesa expects a success response regardless of processing outcome
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Success',
    })
  } catch (error: any) {
    console.error('Error in M-Pesa callback handler:', error)
    
    // Still return success to M-Pesa to prevent retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Success',
    })
  }
}
