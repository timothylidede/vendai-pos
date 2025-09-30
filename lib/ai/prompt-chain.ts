import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore'
import type * as XLSXType from 'xlsx'
// Lazy PDF parser holder to avoid bundling debug harness from pdf-parse/index.js
let pdfParse: null | ((buf: Buffer | Uint8Array) => Promise<{ text: string }>) = null
import OpenAI from 'openai'
import { INVENTORY_COL, POS_PRODUCTS_COL } from '@/lib/pos-operations'

// Chapter 1: Prompt Chaining — lightweight chain orchestrator for product document processing
// This module implements a sequential, structured pipeline: detect → extract → normalize → validate → upsert
// Each step returns machine-readable outputs that feed into the next step. LLM use is optional (CSV path is deterministic).

export type RawRecord = Record<string, any>

export type CanonicalProduct = {
  name: string
  brand?: string
  category?: string
  supplier?: string
  pieceBarcode?: string
  cartonBarcode?: string
  retailUom?: string
  baseUom?: string
  unitsPerBase?: number
  piecePrice?: number
  wholesalePrice?: number
  image?: string
  orgId: string
  updatedAt: string
}

export type ChainContext = {
  orgId: string
  fileName: string
  fileType: 'csv' | 'pdf' | 'xlsx' | 'txt' | 'unknown'
  fileText?: string
  fileBytes?: Uint8Array
  rowsRaw?: string[]
  parsedRecords?: RawRecord[]
  normalized?: CanonicalProduct[]
  invalidRecords?: { index: number; reason: string }[]
  dedupInfo?: { duplicatesInUpload: number }
  upsertStats?: { created: number; updated: number; invCreated: number }
  upsertProductIds?: { id: string; created: boolean }[]
}

export type ChainTrace = Array<{
  step: string
  ok: boolean
  summary?: string
  error?: string
}>

export interface ChainStep {
  id: string
  run(ctx: ChainContext): Promise<{ ctx: ChainContext; trace: ChainTrace[number] }>
}

// Remove undefined and non-finite numbers before Firestore writes
function pruneForFirestore<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    out[k] = v
  }
  return out as T
}

// Utility: CSV parse to array of objects using header row
function parseCsv(text: string): RawRecord[] {
  const lines = text.split(/\r?\n/).map(l => l.trim())
  const nonEmpty = lines.filter(Boolean)
  if (nonEmpty.length < 2) return []
  const headers = nonEmpty[0].split(',').map(h => h.trim())
  return nonEmpty.slice(1).map((line) => {
    const values = line.split(',').map(v => v.trim())
    const obj: RawRecord = {}
    headers.forEach((h, i) => { obj[h.toLowerCase()] = values[i] ?? '' })
    return obj
  })
}

async function parseXlsx(bytes?: Uint8Array): Promise<RawRecord[]> {
  if (!bytes) return []
  const XLSX: typeof XLSXType = await import('xlsx')
  const wb = XLSX.read(bytes, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[]
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).toLowerCase(), v])))
}

async function llmExtractProductsFromText(text: string): Promise<RawRecord[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []
  const client = new OpenAI({ apiKey })
  const system = 'You are a Product Data Extractor. Output ONLY valid JSON matching an array of objects with keys: name, brand, category, supplier, pieceBarcode, cartonBarcode, retailUom, baseUom, unitsPerBase, piecePrice, wholesalePrice, image.'
  const user = `Extract product rows from the following text and return JSON array. If a field is missing, use empty string or 0. Text:\n\n${text.slice(0, 15000)}`
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0,
    messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
    response_format: { type: 'json_object' }
  })
  const content = resp.choices?.[0]?.message?.content || '{}'
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed as RawRecord[]
    if (Array.isArray(parsed.items)) return parsed.items as RawRecord[]
    if (parsed.products && Array.isArray(parsed.products)) return parsed.products as RawRecord[]
  } catch {
    // ignore
  }
  return []
}

// Step 1: Detect file type
export const DetectStep: ChainStep = {
  id: 'detect',
  async run(ctx) {
    const ext = (ctx.fileName.split('.').pop() || '').toLowerCase()
    const map: Record<string, ChainContext['fileType']> = { csv: 'csv', xlsx: 'xlsx', xls: 'xlsx', pdf: 'pdf', txt: 'txt' }
    const fileType = map[ext] || 'unknown'
    return { ctx: { ...ctx, fileType }, trace: { step: this.id, ok: true, summary: `type=${fileType}` } }
  }
}

// Step 2: Extract records (CSV deterministic; other types may use LLM if available)
export const ExtractStep: ChainStep = {
  id: 'extract',
  async run(ctx) {
    if (ctx.fileType === 'csv') {
      const text = ctx.fileText || ''
      const records = parseCsv(text)
      const ok = records.length > 0
      return {
        ctx: { ...ctx, parsedRecords: records },
        trace: { step: this.id, ok, summary: ok ? `records=${records.length}` : 'no records' }
      }
    }

    if (ctx.fileType === 'xlsx') {
      const records = await parseXlsx(ctx.fileBytes)
      const ok = records.length > 0
      return { ctx: { ...ctx, parsedRecords: records }, trace: { step: this.id, ok, summary: ok ? `xlsx=${records.length}` : 'xlsx:0' } }
    }

    if (ctx.fileType === 'pdf' || ctx.fileType === 'txt') {
      let text = ctx.fileText || ''
      if (!text && ctx.fileBytes && ctx.fileType === 'pdf') {
        try {
          if (!pdfParse) {
            // Import the library's internal implementation to bypass index.js debug code
            const mod: any = await import('pdf-parse/lib/pdf-parse.js')
            pdfParse = (mod?.default || mod) as (buf: Buffer | Uint8Array) => Promise<{ text: string }>
          }
          const data = await pdfParse(Buffer.from(ctx.fileBytes))
          text = data.text || ''
        } catch {
          /* no-op */
        }
      }
      const records = text ? await llmExtractProductsFromText(text) : []
      const ok = records.length > 0
      if (!ok) {
        return { ctx, trace: { step: this.id, ok: false, error: `Extraction failed for ${ctx.fileType} (missing OPENAI_API_KEY or low quality text)` } }
      }
      return { ctx: { ...ctx, parsedRecords: records }, trace: { step: this.id, ok: true, summary: `extracted=${records.length}` } }
    }

    return { ctx, trace: { step: this.id, ok: false, error: `Unsupported file type for extraction: ${ctx.fileType}` } }
  }
}

// Step 3: Normalize to canonical product schema
export const NormalizeStep: ChainStep = {
  id: 'normalize',
  async run(ctx) {
    const rows = ctx.parsedRecords || []
    const now = new Date().toISOString()
    const normalized: CanonicalProduct[] = rows.map((r) => {
      const lc = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])) as RawRecord
      const pick = (keys: string[], def: any = ''): any => {
        for (const k of keys) { if (lc[k] !== undefined && lc[k] !== '') return lc[k] }
        return def
      }
      const num = (x: any): number => {
        const n = Number(String(x ?? '').replace(/[^0-9.\-]/g, ''))
        return Number.isFinite(n) ? n : 0
      }
      const name = String(pick(['name','product','product name'], 'Unnamed Product'))
      const brand = String(pick(['brand'], ''))
      const category = String(pick(['category'], 'Uncategorized'))
  const supplier = String(pick(['supplier','vendor','distributor','manufacturer','maker'], ''))
      const pieceBarcode = String(pick(['piecebarcode','piece barcode','barcode','ean','upc','sku'], ''))
      const cartonBarcode = String(pick(['cartonbarcode','carton barcode','masterbarcode','master barcode'], ''))
      const retailUom = String(pick(['retailuom','retail uom','unit','uom'], 'PCS'))
      const baseUom = String(pick(['baseuom','base uom'], 'CTN'))
      const unitsPerBase = num(pick(['unitsperbase','units per base','packsize','pack size','units/ctn','units per ctn'], 1)) || 1
      const piecePrice = num(pick(['pieceprice','unit price','price','unitprice'], 0))
      const wholesalePrice = num(pick(['wholesaleprice','cartonprice','distributor price','carton price','wholesale','wholesale price'], 0)) || undefined
      const image = String(pick(['image','image url','image_url','img'], ''))

      return {
        orgId: ctx.orgId,
        name,
        brand: brand || undefined,
        category,
        supplier: supplier || undefined,
        pieceBarcode: pieceBarcode || undefined,
        cartonBarcode: cartonBarcode || undefined,
        retailUom,
        baseUom,
        unitsPerBase,
        piecePrice,
        wholesalePrice,
        image: image || undefined,
        updatedAt: now,
      }
    })
    return { ctx: { ...ctx, normalized }, trace: { step: this.id, ok: true, summary: `normalized=${normalized.length}` } }
  }
}

// Step 4: Validate and deduplicate within upload
export const ValidateStep: ChainStep = {
  id: 'validate',
  async run(ctx) {
    let items = ctx.normalized || []
    const MAX = 1500
    let truncated = false
    if (items.length > MAX) { items = items.slice(0, MAX); truncated = true }
    const seen = new Set<string>()
    const invalid: { index: number; reason: string }[] = []
    let duplicatesInUpload = 0
    items.forEach((p, idx) => {
      const key = (p.pieceBarcode || p.name).toLowerCase()
      if (!key) invalid.push({ index: idx, reason: 'missing name/barcode' })
      if (seen.has(key)) duplicatesInUpload++
      seen.add(key)
    })
    return { ctx: { ...ctx, normalized: items, invalidRecords: invalid, dedupInfo: { duplicatesInUpload } }, trace: { step: this.id, ok: true, summary: `invalid=${invalid.length}; dupInUpload=${duplicatesInUpload}${truncated ? '; truncated' : ''}` } }
  }
}

// Step 5: Upsert into Firestore, create inventory stubs
export const UpsertStep: ChainStep = {
  id: 'upsert',
  async run(ctx) {
    const items = ctx.normalized || []
    let created = 0, updated = 0, invCreated = 0
    const upsertProductIds: { id: string; created: boolean }[] = []

    for (const p of items) {
      // Attempt to find existing product by barcode or name (org-agnostic first, then fallback)
      let existingId: string | null = null
      if (p.pieceBarcode) {
        const byBarcode = await getDocs(query(collection(db, POS_PRODUCTS_COL), where('pieceBarcode', '==', p.pieceBarcode), limit(1)))
        if (!byBarcode.empty) existingId = byBarcode.docs[0].id
      }
      if (!existingId) {
        const byName = await getDocs(query(collection(db, POS_PRODUCTS_COL), where('name', '==', p.name), limit(1)))
        if (!byName.empty) existingId = byName.docs[0].id
      }

      const now = new Date().toISOString()
      const data = pruneForFirestore({ ...p, updatedAt: now })
      let productId: string
      if (existingId) {
        await setDoc(doc(db, POS_PRODUCTS_COL, existingId), data, { merge: true })
        productId = existingId
        updated++
        upsertProductIds.push({ id: productId, created: false })
      } else {
        const newRef = doc(collection(db, POS_PRODUCTS_COL))
        await setDoc(newRef, pruneForFirestore({ ...data, createdAt: now }))
        productId = newRef.id
        created++
        upsertProductIds.push({ id: productId, created: true })
      }

      // Ensure inventory stub exists for this org+product
      const invId = `${ctx.orgId}_${productId}`
      const invRef = doc(db, INVENTORY_COL, invId)
      const invSnap = await getDoc(invRef)
      if (!invSnap.exists()) {
        await setDoc(invRef, {
          orgId: ctx.orgId,
          productId,
          qtyBase: 0,
          qtyLoose: 0,
          unitsPerBase: p.unitsPerBase || 1,
          updatedAt: now,
          updatedBy: 'chain-upload'
        })
        invCreated++
      }
    }

    return { ctx: { ...ctx, upsertStats: { created, updated, invCreated }, upsertProductIds }, trace: { step: this.id, ok: true, summary: `created=${created}; updated=${updated}; inv=${invCreated}` } }
  }
}

export async function runProcessingChain(params: { orgId: string; fileName: string; fileText?: string; fileBytes?: Uint8Array }): Promise<{ ok: boolean; ctx: ChainContext; trace: ChainTrace; error?: string }>{
  const initial: ChainContext = { orgId: params.orgId, fileName: params.fileName, fileType: 'unknown', fileText: params.fileText, fileBytes: params.fileBytes }
  const trace: ChainTrace = []
  let ctx = initial

  const steps: ChainStep[] = [DetectStep, ExtractStep, NormalizeStep, ValidateStep, UpsertStep]
  for (const step of steps) {
    const res = await step.run(ctx)
    trace.push(res.trace)
    ctx = res.ctx
    if (!res.trace.ok) {
      return { ok: false, ctx, trace, error: res.trace.error || `Step ${step.id} failed` }
    }
  }
  return { ok: true, ctx, trace }
}
