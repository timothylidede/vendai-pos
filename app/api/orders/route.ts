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
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  withErrorHandling, 
  ApiErrors, 
  successResponse,
  checkRateLimit
} from '@/lib/api-error-handling'
import logger from '@/lib/logger'

interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
  category?: string
}

interface OrderData {
  userId: string
  retailerId: string
  retailerName: string
  distributorId: string
  distributorName: string
  items: OrderItem[]
  subTotal: number
  tax: number
  total: number
  paymentMethod: 'cash' | 'credit' | 'mpesa'
  paymentStatus: 'pending' | 'paid' | 'partial'
  deliveryAddress: string
  notes?: string
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
}

// POST - Create new order
export async function POST(request: NextRequest) {
  try {
    const orderData: OrderData = await request.json()

    // Validate required fields
    if (!orderData.userId || !orderData.items || orderData.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and items' },
        { status: 400 }
      )
    }

    // Calculate totals
    const subTotal = orderData.items.reduce((sum, item) => sum + item.total, 0)
    const taxRate = 0.16 // 16% VAT
    const tax = subTotal * taxRate
    const total = subTotal + tax

    // Create order object
    const newOrder = {
      ...orderData,
      subTotal,
      tax,
      total,
      status: 'pending' as const,
      paymentStatus: orderData.paymentMethod === 'credit' ? 'pending' as const : 'paid' as const,
      orderDate: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    // Add to Firebase
    const docRef = await addDoc(collection(db, 'orders'), newOrder)

    // Update retailer's order statistics
    try {
      const retailerRef = doc(db, 'retailers', orderData.retailerId)
      await updateDoc(retailerRef, {
        totalOrders: increment(1),
        totalGMV: increment(total),
        lastOrderDate: new Date().toISOString().split('T')[0],
        lastActivity: 'Just now',
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.warn('Failed to update retailer stats:', error)
    }

    return NextResponse.json({
      success: true,
      orderId: docRef.id,
      order: { id: docRef.id, ...newOrder }
    })

  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

// GET - Fetch orders with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const distributorId = searchParams.get('distributorId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    
    let q = query(collection(db, 'orders'))

    // Apply filters
    if (userId) {
      q = query(q, where('userId', '==', userId))
    }
    if (distributorId) {
      q = query(q, where('distributorId', '==', distributorId))
    }
    if (status) {
      q = query(q, where('status', '==', status))
    }

    // Add ordering and limit
    q = query(q, orderBy('createdAt', 'desc'))
    if (limitParam) {
      q = query(q, limit(parseInt(limitParam)))
    } else {
      q = query(q, limit(50))
    }

    const querySnapshot = await getDocs(q)
    const orders: any[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      })
    })

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length
    })

  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

// PUT - Update order status
export async function PUT(request: NextRequest) {
  try {
    const { orderId, status, paymentStatus, notes } = await request.json()

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const orderRef = doc(db, 'orders', orderId)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }

    if (status) updateData.status = status
    if (paymentStatus) updateData.paymentStatus = paymentStatus
    if (notes) updateData.notes = notes

    await updateDoc(orderRef, updateData)

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully'
    })

  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

// Helper function for increment (since it might not be imported)
function increment(value: number) {
  return {
    __type: 'increment',
    value: value
  }
}