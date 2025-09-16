import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, getDocs, query, setDoc, where, limit, getDoc } from 'firebase/firestore'
import { POS_PRODUCTS_COL, INVENTORY_COL } from '@/lib/pos-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Very lightweight CSV parser for a minimal template
function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const idx = (k: string) => header.indexOf(k)
  const get = (cols: string[], i: number) => (i >= 0 && i < cols.length ? cols[i].trim() : '')
  const out: any[] = []
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(',')
    if (cols.every(c => !c || !c.trim())) continue
    const name = get(cols, idx('name')) || get(cols, idx('product name'))
    if (!name) continue
    out.push({
      name,
      brand: get(cols, idx('brand')) || undefined,
      category: get(cols, idx('category')) || undefined,
      pieceBarcode: get(cols, idx('barcode')) || undefined,
      cartonBarcode: get(cols, idx('carton barcode')) || undefined,
      retailUom: get(cols, idx('retail uom')) || 'PCS',
      baseUom: get(cols, idx('base uom')) || 'CTN',
      unitsPerBase: Number(get(cols, idx('units per base')) || '1') || 1,
      piecePrice: Number(get(cols, idx('unit price')) || '0') || 0,
      wholesalePrice: Number(get(cols, idx('carton price')) || '0') || undefined,
      image: '/placeholder.jpg'
    })
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
  const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 })
  const orgId = (form.get('orgId') as string) || ''
    const buf = Buffer.from(await file.arrayBuffer())
    const text = buf.toString('utf8')
    const rows = parseCsv(text)
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No valid rows' }, { status: 400 })

    // Upsert into pos_products by name+barcode heuristic
    let created = 0, updated = 0, invCreated = 0
    for (const r of rows.slice(0, 500)) {
      let existingId: string | null = null
      if (r.pieceBarcode) {
        const q1 = query(collection(db, POS_PRODUCTS_COL), where('pieceBarcode', '==', r.pieceBarcode), limit(1))
        const s1 = await getDocs(q1)
        if (!s1.empty) existingId = s1.docs[0].id
      }
      if (!existingId && r.cartonBarcode) {
        const q2 = query(collection(db, POS_PRODUCTS_COL), where('cartonBarcode', '==', r.cartonBarcode), limit(1))
        const s2 = await getDocs(q2)
        if (!s2.empty) existingId = s2.docs[0].id
      }
      const data = {
        name: r.name,
        brand: r.brand,
        category: r.category,
        pieceBarcode: r.pieceBarcode,
        cartonBarcode: r.cartonBarcode,
        retailUom: r.retailUom,
        baseUom: r.baseUom,
        unitsPerBase: r.unitsPerBase,
        piecePrice: r.piecePrice,
        wholesalePrice: r.wholesalePrice,
        image: r.image,
        updatedAt: new Date().toISOString(),
      }
      let productId: string
      if (existingId) {
        await setDoc(doc(db, POS_PRODUCTS_COL, existingId), data, { merge: true })
        updated++
        productId = existingId
      } else {
        const newRef = doc(collection(db, POS_PRODUCTS_COL))
        await setDoc(newRef, { ...data, createdAt: new Date().toISOString() })
        created++
        productId = newRef.id
      }

      // Optionally create inventory stub to unlock modules
      if (orgId) {
        const invId = `${orgId}_${productId}`
        const invRef = doc(db, INVENTORY_COL, invId)
        const exists = await getDoc(invRef)
        if (!exists.exists()) {
          await setDoc(invRef, {
            orgId,
            productId,
            qtyBase: 0,
            qtyLoose: 0,
            unitsPerBase: data.unitsPerBase || 1,
            updatedAt: new Date().toISOString(),
            updatedBy: 'upload'
          })
          invCreated++
        }
      }
    }

    return NextResponse.json({ ok: true, created, updated, inventoryStubs: invCreated, total: rows.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Upload failed' }, { status: 400 })
  }
}
