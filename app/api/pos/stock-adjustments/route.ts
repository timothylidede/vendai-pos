import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, runTransaction } from 'firebase/firestore'
import type { InventoryRecord } from '@/lib/types'
import { INVENTORY_COL } from '@/lib/pos-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const { orgId, productId, qtyChangePieces, reason, userId } = body || {}
  if (!orgId || !productId || !Number.isFinite(qtyChangePieces)) {
    return NextResponse.json({ ok: false, error: 'orgId, productId, qtyChangePieces required' }, { status: 400 })
  }

  try {
    await runTransaction(db, async (tx) => {
      const invRef = doc(db, INVENTORY_COL, `${orgId}_${productId}`)
      const snap = await tx.get(invRef)
      if (!snap.exists()) throw new Error('Inventory record not found')
      const inv = snap.data() as InventoryRecord
      const unitsPerBase = inv.unitsPerBase || 1

      // Convert piece delta into base+loose change
      let totalPieces = inv.qtyBase * unitsPerBase + inv.qtyLoose + Number(qtyChangePieces)
      if (totalPieces < 0) throw new Error('Insufficient stock for adjustment')

      const newQtyBase = Math.floor(totalPieces / unitsPerBase)
      const newQtyLoose = totalPieces % unitsPerBase

      tx.update(invRef, {
        qtyBase: newQtyBase,
        qtyLoose: newQtyLoose,
        updatedAt: new Date().toISOString(),
        updatedBy: userId || 'system',
        lastAdjustment: { qtyChangePieces, reason: reason || 'manual' }
      })
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to adjust stock' }, { status: 400 })
  }
}
