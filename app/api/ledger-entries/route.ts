import { NextRequest, NextResponse } from 'next/server'
import {
  getDocs,
  getDoc,
  orderBy,
  query,
  where,
  limit as limitQuery,
  startAfter,
  type QueryConstraint,
} from 'firebase/firestore'

import {
  ledgerEntriesCollection,
  ledgerEntryDoc,
} from '@/lib/b2b-order-store'
import { serializeLedgerEntry } from '@/lib/b2b-order-utils'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const retailerId = searchParams.get('retailerId')
    const supplierId = searchParams.get('supplierId')
    const retailerOrgId = searchParams.get('retailerOrgId')
    const supplierOrgId = searchParams.get('supplierOrgId')
    const payoutStatus = searchParams.get('payoutStatus')
    const reconciliationStatus = searchParams.get('reconciliationStatus')
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')

    const limitValue = Math.min(
      Math.max(Number.parseInt(limitParam ?? '', 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )

    const filters: QueryConstraint[] = []

    if (retailerId) filters.push(where('retailerId', '==', retailerId))
    if (supplierId) filters.push(where('supplierId', '==', supplierId))
    if (retailerOrgId) filters.push(where('retailerOrgId', '==', retailerOrgId))
    if (supplierOrgId) filters.push(where('supplierOrgId', '==', supplierOrgId))
    if (payoutStatus) filters.push(where('payoutStatus', '==', payoutStatus))
    if (reconciliationStatus) {
      filters.push(where('reconciliationStatus', '==', reconciliationStatus))
    }

    const cursorSnapshot = cursor ? await getDoc(ledgerEntryDoc(cursor)) : null

    const collectionQuery = query(
      ledgerEntriesCollection(),
      ...filters,
      orderBy('createdAt', 'desc'),
      ...(cursorSnapshot && cursorSnapshot.exists() ? [startAfter(cursorSnapshot)] : []),
      limitQuery(limitValue + 1),
    )

    const snapshot = await getDocs(collectionQuery)
    const docs = snapshot.docs
    const hasMore = docs.length > limitValue
    const visibleDocs = hasMore ? docs.slice(0, limitValue) : docs
    const entries = visibleDocs.map((docSnap) => serializeLedgerEntry(docSnap.id, docSnap.data()))
    const lastDoc = visibleDocs[visibleDocs.length - 1] ?? null

    return NextResponse.json({
      success: true,
      count: entries.length,
      ledgerEntries: entries,
      nextCursor: hasMore && lastDoc ? lastDoc.id : null,
      hasMore,
    })
  } catch (error) {
    console.error('Failed to fetch ledger entries', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ledger entries' },
      { status: 500 },
    )
  }
}
