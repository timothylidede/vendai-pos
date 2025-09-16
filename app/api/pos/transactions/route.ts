import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, runTransaction, setDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { addPosOrder, POS_ORDERS_COL, POS_PRODUCTS_COL } from '@/lib/pos-operations'
import type { POSOrderLine } from '@/lib/types'
import { assertInventoryReady, verifyApiKey } from '@/lib/org-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Collections (additional)
const POS_INGEST_IDS_COL = 'pos_ingest_ids' // idempotency keys
const POS_EXCEPTIONS_COL = 'pos_exceptions'
const POS_MAPPINGS_COL = 'pos_mappings'

// Resolve a barcode to our product id from pos_products
async function resolveProductIdByBarcode(barcode: string): Promise<{ productId: string | null, productName?: string }>{
  if (!barcode) return { productId: null }
  try {
    // Firestore doesn't support contains; we store pieceBarcode/cartonBarcode on docs
    const q1 = query(collection(db, POS_PRODUCTS_COL), where('pieceBarcode', '==', barcode), limit(1))
    const s1 = await getDocs(q1)
    if (!s1.empty) {
      const d = s1.docs[0]
      const data = d.data() as any
      return { productId: d.id, productName: data?.name }
    }
    const q2 = query(collection(db, POS_PRODUCTS_COL), where('cartonBarcode', '==', barcode), limit(1))
    const s2 = await getDocs(q2)
    if (!s2.empty) {
      const d = s2.docs[0]
      const data = d.data() as any
      return { productId: d.id, productName: data?.name }
    }
    return { productId: null }
  } catch {
    return { productId: null }
  }
}

// Resolve by mapping table (vendor or generic) and key (e.g., vendor SKU or alias)
async function resolveProductIdByMapping(orgId: string, vendor: string, key: string): Promise<string | null> {
  try {
    const id = `${orgId}_${vendor || 'generic'}_${key}`
    const ref = doc(db, POS_MAPPINGS_COL, id)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data() as any
      return data?.productId || null
    }
    // try generic fallback
    if (vendor && vendor !== 'generic') {
      const gid = `${orgId}_generic_${key}`
      const gref = doc(db, POS_MAPPINGS_COL, gid)
      const gsnap = await getDoc(gref)
      if (gsnap.exists()) {
        const data = gsnap.data() as any
        return data?.productId || null
      }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orgId, source, transaction } = body || {}
  if (!orgId || !transaction || !transaction?.txId) {
    return NextResponse.json({ ok: false, error: 'orgId and transaction.txId are required' }, { status: 400 })
  }

  // Enforce inventory readiness
  const ready = await assertInventoryReady(orgId)
  if (!ready.ok && ready.reason !== 'sandbox_allowed') {
    return NextResponse.json({ ok: false, error: 'Inventory not ready. Complete onboarding before posting POS transactions.' }, { status: 409 })
  }

  // Optional M2M access via ApiKey header
  const authHeader = req.headers.get('authorization') || ''
  const apiKey = authHeader.startsWith('ApiKey ') ? authHeader.slice('ApiKey '.length).trim() : null
  if (apiKey) {
    const ok = await verifyApiKey(orgId, apiKey)
    if (!ok) return NextResponse.json({ ok: false, error: 'Invalid ApiKey' }, { status: 401 })
  }

  const vendor = source?.vendor || 'external'
  const storeId = source?.storeId || 'unknown_store'
  const deviceId = source?.deviceId || 'unknown_device'
  const compositeId = `${orgId}_${vendor}_${storeId}_${transaction.txId}`

  // Step 1: Idempotency create-or-return (write a pending record first)
  try {
    const idemRef = doc(db, POS_INGEST_IDS_COL, compositeId)
    const existing = await getDoc(idemRef)
    if (existing.exists()) {
      const data = existing.data() as any
      if (data?.orderId) {
        return NextResponse.json({ ok: true, orderId: data.orderId, idempotent: true })
      }
      // if status is pending from another in-flight request, respond with 202
      return NextResponse.json({ ok: false, status: 'pending' }, { status: 202 })
    }

    // Atomically create pending marker to avoid double creation
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(idemRef)
      if (snap.exists()) return
      tx.set(idemRef, {
        orgId,
        vendor,
        storeId,
        deviceId,
        txId: transaction.txId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    })

    // Step 2: Map items to POSOrderLine[] (outside transaction)
    const items: any[] = Array.isArray(transaction?.items) ? transaction.items : []
    const lines: POSOrderLine[] = []
    const exceptions: any[] = []

    for (const it of items) {
      const qty = Number(it?.qtyPieces || it?.qty || 0)
      const unitPrice = Number(it?.unitPrice || 0)
      if (!qty || qty <= 0 || unitPrice < 0) {
        exceptions.push({ reason: 'invalid_line_qty_or_price', it })
        continue
      }
      let resolvedId: string | null = null
      let resolvedName: string | undefined

      if (it?.productId) {
        resolvedId = String(it.productId)
      } else if (it?.barcode) {
        const { productId, productName } = await resolveProductIdByBarcode(String(it.barcode))
        resolvedId = productId
        resolvedName = productName
      }
      if (!resolvedId && it?.skuRef) {
        resolvedId = await resolveProductIdByMapping(orgId, vendor, String(it.skuRef))
      }

      if (!resolvedId) {
        exceptions.push({ reason: 'unmapped_item', it })
        continue
      }
      const name = resolvedName || it?.name || 'Item'
      const line: POSOrderLine = {
        productId: resolvedId,
        name,
        quantityPieces: qty,
        unitPrice,
        lineTotal: qty * unitPrice,
      }
      lines.push(line)
    }

    if (!lines.length) {
      // mark failed and return
      await setDoc(idemRef, { status: 'failed', failedAt: new Date().toISOString(), reason: 'no_valid_lines' }, { merge: true })
      return NextResponse.json({ ok: false, error: 'No valid lines to process' }, { status: 400 })
    }

    // Step 3: Apply inventory decrement by creating a POS order
    const userId = transaction?.cashierId || 'edge'
    const createdId = await addPosOrder(orgId, userId, lines)

    // Step 4: finalize idempotency record
    await setDoc(idemRef, { status: 'completed', orderId: createdId, completedAt: new Date().toISOString() }, { merge: true })

    // Step 5: Persist exceptions (if any)
    if (exceptions.length) {
      const exRef = doc(collection(db, POS_EXCEPTIONS_COL))
      await setDoc(exRef, {
        orgId,
        source,
        txId: transaction.txId,
        reason: 'mapping_exceptions',
        items: exceptions,
        createdAt: new Date().toISOString(),
        status: 'open',
      })
    }

    return NextResponse.json({ ok: true, orderId: createdId })
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : 'Failed to ingest transaction'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
