import { NextRequest, NextResponse } from 'next/server'
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  getDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface SettlementData {
  distributorId: string
  month: string
  gmv: number
  settlement: number
  status: 'pending' | 'paid' | 'overdue'
  dueDate: string
  paidDate?: string
  paidAmount?: number
  notes?: string
}

// POST - Create new settlement or calculate current month
export async function POST(request: NextRequest) {
  try {
    const { action, distributorId, month } = await request.json()

    if (action === 'calculate') {
      // Calculate settlement for a specific month
      return await calculateMonthlySettlement(distributorId, month)
    } else {
      // Record settlement payment
      const settlementData: SettlementData = await request.json()
      return await recordSettlementPayment(settlementData)
    }

  } catch (error) {
    console.error('Error in settlements POST:', error)
    return NextResponse.json(
      { error: 'Failed to process settlement request' },
      { status: 500 }
    )
  }
}

// GET - Fetch settlements with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const distributorId = searchParams.get('distributorId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    
    let q = query(collection(db, 'settlements'))

    // Apply filters
    if (distributorId) {
      q = query(q, where('distributorId', '==', distributorId))
    }
    if (status) {
      q = query(q, where('status', '==', status))
    }

    // Add ordering and limit
    q = query(q, orderBy('month', 'desc'))
    if (limitParam) {
      q = query(q, limit(parseInt(limitParam)))
    } else {
      q = query(q, limit(12)) // Default to last 12 months
    }

    const querySnapshot = await getDocs(q)
    const settlements: any[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      settlements.push({
        id: doc.id,
        ...data,
        calculatedAt: data.calculatedAt?.toDate?.()?.toISOString() || data.calculatedAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      })
    })

    // Calculate summary statistics
    const totalUnpaid = settlements
      .filter(s => s.status === 'pending' || s.status === 'overdue')
      .reduce((sum, s) => sum + s.settlement, 0)

    const totalPaid = settlements
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + (s.paidAmount || s.settlement), 0)

    return NextResponse.json({
      success: true,
      settlements,
      summary: {
        totalUnpaid,
        totalPaid,
        count: settlements.length,
        pendingCount: settlements.filter(s => s.status === 'pending').length,
        overdueCount: settlements.filter(s => s.status === 'overdue').length
      }
    })

  } catch (error) {
    console.error('Error fetching settlements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settlements' },
      { status: 500 }
    )
  }
}

// PUT - Update settlement status (mark as paid, overdue, etc.)
export async function PUT(request: NextRequest) {
  try {
    const { settlementId, status, paidAmount, paidDate, notes } = await request.json()

    if (!settlementId) {
      return NextResponse.json(
        { error: 'Settlement ID is required' },
        { status: 400 }
      )
    }

    const settlementRef = doc(db, 'settlements', settlementId)
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    }

    if (paidAmount) updateData.paidAmount = paidAmount
    if (paidDate) updateData.paidDate = paidDate
    if (notes) updateData.notes = notes

    await updateDoc(settlementRef, updateData)

    return NextResponse.json({
      success: true,
      message: 'Settlement updated successfully'
    })

  } catch (error) {
    console.error('Error updating settlement:', error)
    return NextResponse.json(
      { error: 'Failed to update settlement' },
      { status: 500 }
    )
  }
}

// Helper function to calculate monthly settlement
async function calculateMonthlySettlement(distributorId: string, month: string) {
  try {
    // Query orders for the specific month and distributor
    const ordersQuery = query(
      collection(db, 'orders'),
      where('distributorId', '==', distributorId),
      where('status', '!=', 'cancelled'),
      orderBy('createdAt', 'desc')
    )

    const ordersSnapshot = await getDocs(ordersQuery)
    let monthlyGMV = 0
    let orderCount = 0

    ordersSnapshot.forEach((doc) => {
      const order = doc.data()
      const orderDate = order.createdAt?.toDate?.() || new Date(order.orderDate || order.createdAt)
      const orderMonth = orderDate.toISOString().slice(0, 7) // YYYY-MM

      if (orderMonth === month) {
        monthlyGMV += order.total || 0
        orderCount++
      }
    })

    // Calculate 5% settlement
    const settlement = monthlyGMV * 0.05

    // Generate due date (15th of next month)
    const [year, monthNum] = month.split('-')
    const nextMonth = new Date(parseInt(year), parseInt(monthNum), 15)
    const dueDate = nextMonth.toISOString().split('T')[0]

    const settlementData = {
      distributorId,
      month,
      gmv: monthlyGMV,
      settlement,
      status: 'pending' as const,
      dueDate,
      orderCount,
      calculatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }

    // Save to Firebase
    const docRef = await addDoc(collection(db, 'settlements'), settlementData)

    return NextResponse.json({
      success: true,
      settlementId: docRef.id,
      data: {
        id: docRef.id,
        ...settlementData,
        gmv: monthlyGMV,
        settlement,
        orderCount
      }
    })

  } catch (error) {
    console.error('Error calculating settlement:', error)
    throw error
  }
}

// Helper function to record settlement payment
async function recordSettlementPayment(settlementData: SettlementData) {
  try {
    const docRef = await addDoc(collection(db, 'settlements'), {
      ...settlementData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    return NextResponse.json({
      success: true,
      settlementId: docRef.id,
      message: 'Settlement payment recorded successfully'
    })

  } catch (error) {
    console.error('Error recording settlement payment:', error)
    throw error
  }
}