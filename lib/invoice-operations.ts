/**
 * Invoice operations for distributor invoicing system
 */

import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore'

export interface InvoiceItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit: string
  category: string
  brand: string
}

export interface Invoice {
  id?: string
  invoiceNumber: string
  distributorId: string
  distributorName: string
  retailerId: string
  retailerName: string
  retailerEmail: string
  retailerPhone?: string
  retailerAddress?: string
  
  // Invoice details
  invoiceDate: string
  dueDate: string
  paymentTerms: string
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'
  
  // Items and totals
  items: InvoiceItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  
  // Payment tracking
  amountPaid: number
  amountDue: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  lastPaymentDate?: string
  
  // GMV tracking for 5% settlement
  gmvContribution: number
  settlementStatus: 'pending' | 'calculated' | 'paid'
  settlementAmount: number // 5% of GMV
  
  // Metadata
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy: string // distributor user ID
  
  // Email tracking
  emailSentAt?: string
  emailViewedAt?: string
  reminderCount: number
  lastReminderAt?: string
}

export interface InvoiceStats {
  totalInvoices: number
  totalAmount: number
  paidAmount: number
  overdueAmount: number
  pendingAmount: number
  totalGMV: number
  settlementDue: number
}

/**
 * Generate next invoice number for a distributor
 */
export async function generateInvoiceNumber(distributorId: string): Promise<string> {
  try {
    const invoicesRef = collection(db, 'distributors', distributorId, 'invoices')
    const q = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextNumber = 1
    if (!snapshot.empty) {
      const lastInvoice = snapshot.docs[0].data()
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0')
      nextNumber = lastNumber + 1
    }
    
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    
    return `INV-${year}${month}-${String(nextNumber).padStart(4, '0')}`
  } catch (error) {
    console.error('Error generating invoice number:', error)
    const timestamp = Date.now().toString().slice(-6)
    return `INV-${new Date().getFullYear()}-${timestamp}`
  }
}

/**
 * Create a new invoice
 */
export async function createInvoice(
  distributorId: string, 
  distributorName: string,
  retailerInfo: {
    id: string
    name: string
    email: string
    phone?: string
    address?: string
  },
  items: InvoiceItem[],
  paymentTerms: string = 'Net 30',
  taxRate: number = 16, // 16% VAT in Kenya
  notes?: string,
  createdBy: string = ''
): Promise<Invoice> {
  try {
    const invoiceNumber = await generateInvoiceNumber(distributorId)
    const now = new Date()
    const dueDate = new Date(now)
    
    // Set due date based on payment terms
    const termsDays = parseInt(paymentTerms.replace('Net ', '')) || 30
    dueDate.setDate(dueDate.getDate() + termsDays)
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const taxAmount = (subtotal * taxRate) / 100
    const total = subtotal + taxAmount
    const gmvContribution = subtotal // GMV is pre-tax amount
    const settlementAmount = (gmvContribution * 5) / 100 // 5% of GMV
    
    const invoice: Invoice = {
      invoiceNumber,
      distributorId,
      distributorName,
      retailerId: retailerInfo.id,
      retailerName: retailerInfo.name,
      retailerEmail: retailerInfo.email,
      retailerPhone: retailerInfo.phone,
      retailerAddress: retailerInfo.address,
      
      invoiceDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      paymentTerms,
      status: 'draft',
      
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      
      amountPaid: 0,
      amountDue: total,
      paymentStatus: 'unpaid',
      
      gmvContribution,
      settlementStatus: 'pending',
      settlementAmount,
      
      notes: notes || '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy,
      
      reminderCount: 0
    }
    
    // Add to Firestore
    const invoicesRef = collection(db, 'distributors', distributorId, 'invoices')
    const docRef = await addDoc(invoicesRef, invoice)
    
    return { ...invoice, id: docRef.id }
  } catch (error) {
    console.error('Error creating invoice:', error)
    throw new Error('Failed to create invoice')
  }
}

/**
 * Get invoices for a distributor with pagination
 */
export async function getDistributorInvoices(
  distributorId: string,
  status?: string,
  maxResults: number = 50
): Promise<Invoice[]> {
  try {
    const invoicesRef = collection(db, 'distributors', distributorId, 'invoices')
    let q = query(invoicesRef, orderBy('createdAt', 'desc'), limit(maxResults))
    
    if (status && status !== 'all') {
      q = query(invoicesRef, where('status', '==', status), orderBy('createdAt', 'desc'), limit(maxResults))
    }
    
    const snapshot = await getDocs(q)
    const invoices: Invoice[] = []
    
    snapshot.forEach((doc) => {
      invoices.push({ ...doc.data() as Invoice, id: doc.id })
    })
    
    return invoices
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return []
  }
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  distributorId: string,
  invoiceId: string,
  status: Invoice['status'],
  additionalData?: Partial<Invoice>
): Promise<void> {
  try {
    const invoiceRef = doc(db, 'distributors', distributorId, 'invoices', invoiceId)
    
    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
      ...additionalData
    }
    
    await updateDoc(invoiceRef, updateData)
  } catch (error) {
    console.error('Error updating invoice status:', error)
    throw new Error('Failed to update invoice status')
  }
}

/**
 * Record payment for an invoice
 */
export async function recordPayment(
  distributorId: string,
  invoiceId: string,
  paymentAmount: number,
  paymentDate: string = new Date().toISOString(),
  paymentMethod?: string,
  notes?: string
): Promise<void> {
  try {
    const invoicesRef = collection(db, 'distributors', distributorId, 'invoices')
    const invoiceSnapshot = await getDocs(query(invoicesRef, where('id', '==', invoiceId)))
    
    if (invoiceSnapshot.empty) {
      throw new Error('Invoice not found')
    }
    
    const invoiceDoc = invoiceSnapshot.docs[0]
    const invoice = invoiceDoc.data() as Invoice
    
    const newAmountPaid = (invoice.amountPaid || 0) + paymentAmount
    const newAmountDue = invoice.total - newAmountPaid
    
    let paymentStatus: Invoice['paymentStatus'] = 'partial'
    if (newAmountDue <= 0) {
      paymentStatus = 'paid'
    } else if (newAmountPaid <= 0) {
      paymentStatus = 'unpaid'
    }
    
    const updateData = {
      amountPaid: newAmountPaid,
      amountDue: Math.max(0, newAmountDue),
      paymentStatus,
      lastPaymentDate: paymentDate,
      updatedAt: new Date().toISOString(),
      status: paymentStatus === 'paid' ? 'paid' : invoice.status
    }
    
    await updateDoc(invoiceDoc.ref, updateData)
    
    // Record payment history
    const paymentsRef = collection(db, 'distributors', distributorId, 'invoices', invoiceId, 'payments')
    await addDoc(paymentsRef, {
      amount: paymentAmount,
      date: paymentDate,
      method: paymentMethod || 'manual',
      notes: notes || '',
      recordedAt: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error recording payment:', error)
    throw new Error('Failed to record payment')
  }
}

/**
 * Get invoice statistics for a distributor
 */
export async function getInvoiceStats(distributorId: string): Promise<InvoiceStats> {
  try {
    const invoicesRef = collection(db, 'distributors', distributorId, 'invoices')
    const snapshot = await getDocs(invoicesRef)
    
    let totalInvoices = 0
    let totalAmount = 0
    let paidAmount = 0
    let overdueAmount = 0
    let pendingAmount = 0
    let totalGMV = 0
    let settlementDue = 0
    
    const now = new Date()
    
    snapshot.forEach((doc) => {
      const invoice = doc.data() as Invoice
      totalInvoices++
      totalAmount += invoice.total
      paidAmount += invoice.amountPaid || 0
      totalGMV += invoice.gmvContribution || 0
      
      if (invoice.settlementStatus === 'pending' || invoice.settlementStatus === 'calculated') {
        settlementDue += invoice.settlementAmount || 0
      }
      
      if (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial') {
        const dueDate = new Date(invoice.dueDate)
        if (dueDate < now) {
          overdueAmount += invoice.amountDue || 0
        } else {
          pendingAmount += invoice.amountDue || 0
        }
      }
    })
    
    return {
      totalInvoices,
      totalAmount,
      paidAmount,
      overdueAmount,
      pendingAmount,
      totalGMV,
      settlementDue
    }
  } catch (error) {
    console.error('Error getting invoice stats:', error)
    return {
      totalInvoices: 0,
      totalAmount: 0,
      paidAmount: 0,
      overdueAmount: 0,
      pendingAmount: 0,
      totalGMV: 0,
      settlementDue: 0
    }
  }
}

/**
 * Send invoice email (placeholder - would integrate with email service)
 */
export async function sendInvoiceEmail(
  distributorId: string,
  invoiceId: string
): Promise<void> {
  try {
    // This would integrate with email service like SendGrid, Mailgun, etc.
    console.log(`Sending invoice ${invoiceId} for distributor ${distributorId}`)
    
    // Update invoice status
    await updateInvoiceStatus(distributorId, invoiceId, 'sent', {
      emailSentAt: new Date().toISOString()
    })
    
    // In real implementation:
    // 1. Generate PDF invoice
    // 2. Send via email service
    // 3. Track email delivery and opens
    
  } catch (error) {
    console.error('Error sending invoice email:', error)
    throw new Error('Failed to send invoice email')
  }
}

/**
 * Calculate GMV settlement (5% of total GMV)
 */
export async function calculateSettlement(
  distributorId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalGMV: number
  settlementAmount: number
  invoiceCount: number
  invoices: Invoice[]
}> {
  try {
    const invoicesRef = collection(db, 'distributors', distributorId, 'invoices')
    const q = query(
      invoicesRef,
      where('status', '==', 'paid'),
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(q)
    const invoices: Invoice[] = []
    let totalGMV = 0
    
    snapshot.forEach((doc) => {
      const invoice = { ...doc.data() as Invoice, id: doc.id }
      invoices.push(invoice)
      totalGMV += invoice.gmvContribution || 0
    })
    
    const settlementAmount = (totalGMV * 5) / 100 // 5% of GMV
    
    return {
      totalGMV,
      settlementAmount,
      invoiceCount: invoices.length,
      invoices
    }
  } catch (error) {
    console.error('Error calculating settlement:', error)
    throw new Error('Failed to calculate settlement')
  }
}