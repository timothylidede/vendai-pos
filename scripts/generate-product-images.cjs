/**
 * Generate product images from supplier pricelists using Google Image Search + Replicate img2img
 *
 * Requirements:
 * - REPLICATE_API_TOKEN in environment
 * - Firebase web config in .env.local (NEXT_PUBLIC_FIREBASE_*)
 * - Optional: GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX for Google Custom Search (image search)
 *
 * Behavior:
 * - Parses Mahitaji and Sam West pricelist text/PDF into product objects (reusing logic from import script)
 * - For each product, searches topN reference images (default 5) using Google CSE
 * - Runs Replicate generation:
 *     - If model supports img2img, uses each reference as input
 *     - If model is text-to-image only (e.g., bytedance/seedream-3), uses prompt-only
 * - Writes generated image URLs to Firestore under distributors/{id}/products/{productId}
 *   fields: imageUrl (first), images (array), imageRefs (source reference URLs), imageGen { model, strength, prompt, createdAt }
 *
 * Safety:
 * - Supports --supplier mahitaji|samwest|all, --limit N products, --skip-existing to skip products already having imageUrl
 * - Supports --dry-run to not write to Firestore
 */

const path = require('path')
const fs = require('fs')
// Fetch helper (Node 18+ has global fetch; fallback to node-fetch for older runtimes)
async function getFetch() {
  if (typeof globalThis.fetch === 'function') return globalThis.fetch
  const mod = await import('node-fetch')
  return mod.default
}
const Replicate = require('replicate')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { initializeApp } = require('firebase/app')
const { getFirestore, doc, getDoc, setDoc, writeBatch } = require('firebase/firestore')

// ----- Config / CLI -----
const argv = process.argv.slice(2)
const arg = (name, def = undefined) => {
  const idx = argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return def
  const v = argv[idx]
  const next = argv[idx + 1]
  if (v.includes('=')) return v.split('=')[1]
  if (next && !next.startsWith('--')) return next
  return true
}

const SUPPLIER_FILTER = String(arg('supplier', 'all')) // 'mahitaji' | 'samwest' | 'all'
const LIMIT_PRODUCTS = Number(arg('limit', '10')) // default limit to avoid costs
const REF_TOPN = Math.max(1, Math.min(5, Number(arg('refs', '5'))))
const SEARCH_ONLY = !!arg('search-only', false)
const DRY_RUN = !!arg('dry-run', false)
function parseBool(v, defVal) {
  if (v === undefined) return defVal
  if (v === true) return true
  if (v === false) return false
  const s = String(v).toLowerCase().trim()
  if (['1','true','yes','y','on'].includes(s)) return true
  if (['0','false','no','n','off'].includes(s)) return false
  return defVal
}
const SKIP_EXISTING = (() => {
  if (argv.includes('--no-skip-existing')) return false
  const v = arg('skip-existing', 'true')
  return parseBool(v, true)
})()
const MODEL = process.env.REPLICATE_MODEL || 'google/nano-banana'
const STRENGTH = Number(process.env.REPLICATE_STRENGTH || '0.6')
const OUTPUT_SIZE = process.env.REPLICATE_OUTPUT || ''
// Attempt to detect a slate-like background from globals.css (e.g., rgba(15,23,42,*) -> #0F172A)
function detectSlateHexFromGlobals() {
  try {
    const cssPath = path.join(__dirname, '..', 'app', 'globals.css')
    if (!fs.existsSync(cssPath)) return null
    const css = fs.readFileSync(cssPath, 'utf8')
    const m = css.match(/rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*0?\.\d+\s*\)/)
    if (m) return '#0F172A' // Tailwind slate-900
    // Fallback: try rgba(30,41,59,*) -> slate-800
    const m2 = css.match(/rgba\(\s*30\s*,\s*41\s*,\s*59\s*,\s*0?\.\d+\s*\)/)
    if (m2) return '#1E293B'
    return null
  } catch { return null }
}
const THEME_BG_HEX = process.env.THEME_BG_HEX || detectSlateHexFromGlobals() || '#0F172A'

// Use provided keys as fallbacks: Google Maps key often works across services; NEXT_PUBLIC_CX is the engine id
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY 
  || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY 
  || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX 
  || process.env.NEXT_PUBLIC_GOOGLE_CSE_CX 
  || process.env.NEXT_PUBLIC_CX

// Firebase web config (client SDK) – same as other scripts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('❌ Missing REPLICATE_API_TOKEN in environment. Aborting.')
  process.exit(1)
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

// ----- Utilities -----
function nowIso() { return new Date().toISOString() }

function sleep(ms) { return new Promise(res => setTimeout(res, ms)) }

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function buildPrompt(product) {
  const details = [
    product?.name && `Product name: ${product.name}`,
    product?.brand && `Brand: ${product.brand}`,
    product?.description && `Description: ${product.description}`,
    product?.category && `Category: ${product.category}`,
    product?.unit && `Packaging: ${product.unit}`
  ].filter(Boolean).join('. ')

  const base = `Photorealistic product photo using the supplied reference image. Output a single centered ${product?.category || 'consumer'} product placed on a brown mahogany wooden shelf with visible wood grain. Lighting: warm, studio-quality, 'precious' accent lighting from top-left creating soft highlights and gentle shadows. Background color: ${THEME_BG_HEX}. Camera: 50mm, slight 10° angle, product fully visible, no additional props. Keep product proportions and label text readable. Ensure consistent composition across all SKUs: product centered, same distance from camera, shelf visible across bottom third of frame. High detail, high resolution, natural specular highlights on glossy surfaces. If no license to reproduce brand logos, render neutral label placeholders instead. Output format: ${OUTPUT_SIZE} JPEG.`

  return details ? `${base} Product details: ${details}.` : base
}

// ----- Google CSE Image Search -----
async function searchReferenceImages(query, topN = 5) {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX) {
    console.warn('⚠️  GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX not set. Skipping image search.')
    return []
  }
  const params = new URLSearchParams({
    key: GOOGLE_CSE_API_KEY,
    cx: GOOGLE_CSE_CX,
    q: query,
    searchType: 'image',
    num: String(Math.min(10, Math.max(1, topN))),
    safe: 'active',
  })
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`
  const fetchFn = await getFetch()
  const res = await fetchFn(url)
  if (!res.ok) {
    const txt = await res.text()
    console.warn('⚠️  Google CSE request failed:', res.status, txt)
    return []
  }
  const json = await res.json()
  const items = json.items || []
  return items
    .map(it => it.link)
    .filter(u => typeof u === 'string' && /^(https?:)\/\//i.test(u))
    .slice(0, topN)
}

// ----- Replicate generation (per-model inputs) -----
async function generateWithReferences(imageUrls, prompt, seed) {
  try {
    // Normalize outputs (array of URL strings)
    const normalize = async (out) => {
      // Seedream (new client) may return a File-like object with url()
      const toUrl = async (o) => {
        if (!o) return null
        if (typeof o === 'string') return o
        if (typeof o.url === 'function') {
          try { return await o.url() } catch { return null }
        }
        return null
      }
      if (Array.isArray(out)) {
        const urls = (await Promise.all(out.map(toUrl))).filter(Boolean)
        return urls
      }
      if (out && Array.isArray(out.output)) {
        const urls = (await Promise.all(out.output.map(toUrl))).filter(Boolean)
        return urls
      }
      const single = await toUrl(out)
      return single ? [single] : []
    }

    // Special-case: Seedream 3 is text-to-image (no reference image input)
    if (MODEL.includes('bytedance/seedream-3')) {
      const input = {
        prompt,
        // typical controls; adjust via env if needed
        num_inference_steps: Number(process.env.SEEDREAM_STEPS || 20),
        guidance_scale: Number(process.env.SEEDREAM_GUIDANCE || 7.5),
        // Note: some versions accept "seed"; if unsupported it's ignored
        seed: typeof seed === 'number' ? seed : undefined,
      }
      Object.keys(input).forEach(k => input[k] === undefined && delete input[k])
      const output = await replicate.run(MODEL, { input })
      return await normalize(output)
    }

    // google/nano-banana expects: { prompt, image_input: string[] }
    if (MODEL.includes('google/nano-banana')) {
      const imgArr = (imageUrls || []).filter(Boolean)
      const input = {
        prompt,
        image_input: imgArr,
      }
      const output = await replicate.run(MODEL, { input })
      return await normalize(output)
    }

    // Generic img2img path (models that accept image + prompt) -> use first image
    const firstRef = Array.isArray(imageUrls) ? imageUrls[0] : imageUrls
    const input = { image: firstRef, prompt, strength: STRENGTH, num_outputs: 1 }
    if (typeof seed === 'number') input.seed = seed
    if (OUTPUT_SIZE) input.size = OUTPUT_SIZE
    const output = await replicate.run(MODEL, { input })
    return await normalize(output)
  } catch (err) {
    console.warn('⚠️  Replicate generation failed:', err?.message || err)
    return []
  }
}

// ----- Parsing: reuse logic from import-supplier-products.cjs -----
function categorizeMahitajiProduct(description) {
  const desc = (description || '').toLowerCase()
  if (desc.includes('honey') || desc.includes('salt')) return 'Condiments & Seasonings'
  if (desc.includes('juice') || desc.includes('drink') || desc.includes('rtd')) return 'Beverages'
  if (desc.includes('flour') || desc.includes('ugali') || desc.includes('maize') || desc.includes('atta')) return 'Flour & Grains'
  if (desc.includes('rice') || desc.includes('beans') || desc.includes('spaghetti')) return 'Rice & Grains'
  if (desc.includes('oil') || desc.includes('fat')) return 'Cooking Oils'
  if (desc.includes('soap') || desc.includes('detergent')) return 'Household Items'
  if (desc.includes('milk') || desc.includes('yogurt')) return 'Dairy'
  if (desc.includes('biscuit') || desc.includes('cookie') || desc.includes('snack')) return 'Snacks & Biscuits'
  return 'General'
}

function categorizeSamWestProduct(description) {
  const desc = (description || '').toLowerCase()
  if (desc.includes('rice')) return 'Rice & Grains'
  if (desc.includes('flour') || desc.includes('atta') || desc.includes('maize meal')) return 'Flour & Grains'
  if (desc.includes('sugar')) return 'Sugar & Sweeteners'
  if (desc.includes('oil') || desc.includes('fat')) return 'Cooking Oils'
  if (desc.includes('soap') || desc.includes('detergent') || desc.includes('wipes')) return 'Household Items'
  if (desc.includes('yogurt') || desc.includes('milk')) return 'Dairy'
  if (desc.includes('snack') || desc.includes('biscuit')) return 'Snacks & Biscuits'
  return 'General'
}

function extractBrand(description) {
  const brands = [
    'ACACIA','AFIA','AFYA','AJAB','ALPA','AMAIZE','AMANA','ANEEK','ABABIL','AL-MAHAL','CROWN','FALCON','FZAMI','HIMALAYA','INDUS','JALAL','KARIBU','KING AFRICA','KUKU','MONA','MR RICE','STAR AFRICA','NIP NAP','4U','AVENA','COCACOLA','ROYCO','EXE','MENENGAI'
  ]
  const desc = (description || '').toUpperCase()
  for (const b of brands) if (desc.includes(b)) return b
  const first = (description || '').split(' ')[0]
  if (first && first.length > 2) return first.toUpperCase()
  return 'Generic'
}

function parseMahitajiText(content) {
  const lines = content.split('\n')
  const products = []
  let startIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('CodeItemUnitP7') || lines[i].includes('KK061')) { startIndex = i; break }
  }
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.length < 10) continue
    const mahitajiPattern = /^([A-Z0-9]+)(.+?)(CTN|PC|PKT|BALE|BUNDL|JAR)(.+?)$/
    const m = line.match(mahitajiPattern)
    if (m) {
      const [, code, description, unit, priceStr] = m
      const price = parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', ''))
      if (!isNaN(price) && price > 0) {
        const p = {
          id: `MAH-${String(products.length + 1).padStart(4,'0')}`,
          distributorId: 'mahitaji_enterprises',
          distributorName: 'Mahitaji Enterprises Ltd',
          name: description.trim(),
          sku: code.trim(),
          unitPrice: price,
          unit,
          category: categorizeMahitajiProduct(description),
          minOrderQuantity: 1,
          leadTime: '1-2 days',
          inStock: true,
          supplier: 'mahitaji',
          barcode: null,
          brand: extractBrand(description),
        }
        products.push(p)
      }
    }
  }
  return products
}

function parseSamWestText(content) {
  const lines = content.split('\n')
  const products = []
  let startIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('#Description') || lines[i].includes('BUYING PRICE')) { startIndex = i + 1; break }
  }
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.length < 10) continue
    if (/(Date|Time|Page|Continue|Printed by)/.test(line)) continue
    const samWestPattern = /^(\d+)(.+?)KES\s+([\d,]+\.?\d*)(.+?)$/
    const m = line.match(samWestPattern)
    if (m) {
      const [, number, description, priceStr, unit] = m
      const price = parseFloat(priceStr.replace(/,/g, ''))
      if (!isNaN(price) && price > 0) {
        const cleanDescription = description.replace(/^\d+/, '').trim()
        const cleanUnit = unit.trim()
        const p = {
          id: `SW-${String(products.length + 1).padStart(4,'0')}`,
          distributorId: 'samwest_supermarket',
          distributorName: 'Sam West Supermarket',
          name: cleanDescription,
          sku: `SW${number.padStart(4,'0')}`,
          unitPrice: price,
          unit: cleanUnit,
          category: categorizeSamWestProduct(cleanDescription),
          minOrderQuantity: 1,
          leadTime: '1-3 days',
          inStock: true,
          supplier: 'samwest',
          barcode: null,
          brand: extractBrand(cleanDescription),
        }
        products.push(p)
      }
    }
  }
  return products
}

async function readTextOrPdf(txtPath, pdfPath) {
  if (txtPath && fs.existsSync(txtPath)) {
    return fs.readFileSync(txtPath, 'utf8')
  }
  if (pdfPath && fs.existsSync(pdfPath)) {
    const pdfParse = require('pdf-parse')
    const dataBuffer = fs.readFileSync(pdfPath)
    const res = await pdfParse(dataBuffer)
    return res.text || ''
  }
  return ''
}

// ----- Firestore attach -----
async function attachImagesToProduct(db, distributorId, productId, imageUrls, refUrls, meta) {
  const ref = doc(db, 'distributors', distributorId, 'products', productId)
  const snap = await getDoc(ref).catch(() => null)
  if (!snap || !snap.exists()) {
    console.warn(`⚠️  Product not found ${distributorId}/${productId}, creating stub`)
  }
  const imagesString = (imageUrls || []).map(u => (typeof u === 'string' ? u : String(u)))
  const refsString = (refUrls || []).map(u => (typeof u === 'string' ? u : String(u)))
  const first = imagesString[0] || null
  const payload = {
    imageUrl: first,
    images: imagesString,
    imageRefs: refsString,
    imageGen: {
      model: MODEL,
      strength: STRENGTH,
      output: OUTPUT_SIZE,
      createdAt: nowIso(),
      ...meta,
    },
    updatedAt: nowIso(),
  }
  if (DRY_RUN) {
    console.log('DRY-RUN update', ref.path, payload)
    return
  }
  await setDoc(ref, payload, { merge: true })
}

// ----- Main flow -----
async function main() {
  console.log('🖼️  Generate Supplier Product Images')
  console.log(`   supplier=${SUPPLIER_FILTER}, limit=${LIMIT_PRODUCTS}, refs=${REF_TOPN}, model=${MODEL}, dryRun=${DRY_RUN}, searchOnly=${SEARCH_ONLY}`)
  console.log(`   background=${THEME_BG_HEX} (from env or globals.css) | skipExisting=${SKIP_EXISTING}`)

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  const mahitajiTxt = path.join(__dirname, '..', 'data', 'mahitaji pricelist_extracted_text.txt')
  const mahitajiPdf = path.join(__dirname, '..', 'data', 'mahitaji pricelist.pdf')

  // Note: update this path to match your Sam West extracted txt
  const samwestTxt = path.join(__dirname, '..', 'data', 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt')
  const samwestPdf = null // unknown

  const tasks = []

  if (SUPPLIER_FILTER === 'mahitaji' || SUPPLIER_FILTER === 'all') {
    const text = await readTextOrPdf(mahitajiTxt, mahitajiPdf)
    const products = parseMahitajiText(text)
    tasks.push({ key: 'mahitaji', id: 'mahitaji_enterprises', name: 'Mahitaji Enterprises Ltd', products })
  }
  if (SUPPLIER_FILTER === 'samwest' || SUPPLIER_FILTER === 'all') {
    const text = await readTextOrPdf(samwestTxt, samwestPdf)
    const products = parseSamWestText(text)
    tasks.push({ key: 'samwest', id: 'samwest_supermarket', name: 'Sam West Supermarket', products })
  }

  for (const sup of tasks) {
    console.log(`\n📦 ${sup.name}: ${sup.products.length} parsed products`)
    const subset = sup.products.slice(0, Math.max(0, LIMIT_PRODUCTS))
    let processed = 0
    for (const p of subset) {
      processed++
      const label = `${sup.key}/${p.id} ${p.brand || ''} ${p.name}`.trim()
      console.log(`\n➡️  [${processed}/${subset.length}] ${label}`)

      if (SKIP_EXISTING) {
        const ref = doc(db, 'distributors', sup.id, 'products', p.id)
        const snap = await getDoc(ref).catch(() => null)
        if (snap && snap.exists() && snap.data()?.imageUrl) {
          console.log('   ⏭️  Skipping (already has imageUrl)')
          continue
        }
      }

  const queryParts = [p.brand, p.name, p.unit, p.category].filter(Boolean)
  const query = `${queryParts.join(' ')} product image`
      const refs = await searchReferenceImages(query, REF_TOPN)
      if (!refs.length) { console.warn('   ⚠️  No reference images found'); continue }
      console.log(`   🔎 Found ${refs.length} reference images`)

      const prompt = buildPrompt({
        name: p.name,
        brand: p.brand,
        description: p.name,
        category: p.category,
        unit: p.unit
      })
      if (SEARCH_ONLY) {
        console.log('   🔎 Search-only mode: refs ->')
        refs.forEach((u, i) => console.log(`      [${i+1}] ${u}`))
        continue
      }

      const outputs = []
      let seedBase = Math.abs(hashCode(p.id))

      console.log('   🎨 Generating with reference images')
      const out = await generateWithReferences(refs, prompt, seedBase)
      if (out && out.length) {
        outputs.push(out[0])
        console.log(`   ✅ Generated: ${out[0]}`)
      } else {
        console.log('   ❌ Generation returned no output')
      }

      if (!outputs.length) {
        console.warn('   ⚠️  No generated outputs to attach')
        continue
      }

      await attachImagesToProduct(db, sup.id, p.id, outputs, refs, { prompt })
      console.log(`   📎 Attached ${outputs.length} images to ${sup.id}/${p.id}`)
    }
  }

  console.log('\n✅ Done')
}

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0 }
  return hash
}

main()
  .then(() => { process.exit(0) })
  .catch(err => { console.error('Fatal:', err); process.exit(1) })
