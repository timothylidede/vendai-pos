import { NextRequest, NextResponse } from 'next/server'

// Ensure we use the Node.js runtime (required for multipart/form-data)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ExtractedProduct = {
  name: string
  code?: string
  brand?: string
  category?: string
  variant?: string
  size?: string
  pack_size?: string
  unit?: string
  price_distributor?: number
  price_unit?: number
  supplier?: string
  description?: string
  tags?: string[]
  image_url?: string | null
}

function error(step: string, message: string, status = 400) {
  return NextResponse.json({ success: false, step, error: message }, { status })
}

function parseCsv(text: string): ExtractedProduct[] {
  // Very lightweight CSV parser for simple, comma-separated values without escaped commas
  // Suited for our provided template; for complex files consider a CSV library.
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())

  const idx = (key: string) => header.indexOf(key)
  const get = (cols: string[], i: number) => (i >= 0 && i < cols.length ? cols[i].trim() : '')

  const products: ExtractedProduct[] = []

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(',')
    if (cols.every(c => !c || !c.trim())) continue

    const name = get(cols, idx('product name')) || get(cols, idx('name'))
    if (!name) continue

    const tagsRaw = get(cols, idx('tags'))
    const priceDistributor = get(cols, idx('distributor price'))
    const priceUnit = get(cols, idx('unit price'))

    const prod: ExtractedProduct = {
      name,
      code: get(cols, idx('sku')) || undefined,
      brand: get(cols, idx('brand')) || undefined,
      category: get(cols, idx('category')) || undefined,
      variant: get(cols, idx('variant')) || undefined,
      size: get(cols, idx('size')) || undefined,
      pack_size: get(cols, idx('pack size')) || undefined,
      unit: get(cols, idx('unit')) || undefined,
      price_distributor: priceDistributor ? Number(priceDistributor) : undefined,
      price_unit: priceUnit ? Number(priceUnit) : undefined,
      supplier: get(cols, idx('supplier')) || undefined,
      description: get(cols, idx('description')) || undefined,
      tags: tagsRaw ? tagsRaw.split(/;|\|/).map(t => t.trim()).filter(Boolean) : undefined,
      image_url: '/placeholder.jpg',
    }

    products.push(prod)
  }

  return products
}

export async function POST(req: NextRequest) {
  // 1) Initialization: ensure request has form-data and a file
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    return error('initialization', 'Failed to read form data. Please try again.')
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return error('file_validation', 'No file uploaded. Please attach a CSV, Excel, or PDF file.')
  }

  const fileName = file.name || 'upload'
  const lower = fileName.toLowerCase()

  // 2) File validation: for this first cut, we only process CSV; others return a helpful error
  const allowed = lower.endsWith('.csv')
  if (!allowed) {
    return error(
      'file_validation',
      'Unsupported file type for this preview. Please upload a CSV using the provided template.'
    )
  }

  // 3) Content validation + basic parsing
  let text: string
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    text = buf.toString('utf8')
  } catch (e) {
    return error('ai_extraction', 'Could not read the uploaded file contents.')
  }

  const products = parseCsv(text)
  if (!products.length) {
    return error('data_parsing', 'No valid product rows found. Please use the provided template headers.')
  }

  // 4) Return success payload shaped for the UI
  return NextResponse.json({
    success: true,
    products,
    meta: {
      fileName,
      rows: products.length,
      note:
        'Parsed CSV successfully. This is a preview. Next steps: validation, enrichment, optional image generation, and Firestore import.'
    }
  })
}
 
