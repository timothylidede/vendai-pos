/**
 * OpenAI-Powered TXT Pricelist Extraction
 * Extracts ALL products from distributor TXT pricelists with descriptions
 * Cost-efficient batch processing with GPT-4o-mini
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') });
console.log('📍 Loading env from:', path.join(__dirname, '..', '.env.local'));
console.log('📍 CWD:', process.cwd());

// File logging setup
const LOG_DIR = path.join(process.cwd(), 'data', '.logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_PATH = path.join(LOG_DIR, `extract-products-${RUN_ID}.log`);

function log(...args: any[]) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  try { fs.appendFileSync(LOG_PATH, msg + '\n', 'utf-8'); } catch {}
  // Also print to console
  console.log(msg);
}

const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 300000);
const OPENAI_CHUNK_CHAR_LIMIT = (() => {
  const raw = Number(process.env.OPENAI_CHUNK_CHAR_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return 2200;
  return Math.min(6000, Math.max(1000, Math.floor(raw)));
})();
const OPENAI_MAX_OUTPUT_TOKENS = (() => {
  const raw = Number(process.env.OPENAI_MAX_TOKENS);
  if (!Number.isFinite(raw) || raw <= 0) return 1600;
  return Math.min(5000, Math.max(512, Math.floor(raw)));
})();
const RETRY_SPLIT_CHUNK_LIMIT = Math.max(900, Math.floor(OPENAI_CHUNK_CHAR_LIMIT / 2));
const IS_DRY_RUN = process.env.OPENAI_EXTRACT_DRY_RUN === '1' || process.argv.includes('--dry-run');
const MAX_CHUNKS = (() => {
  const arg = process.argv.find(a => a.startsWith('--max-chunks='));
  if (!arg) return 0;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
})();
const START_PAGE = (() => {
  const arg = process.argv.find(a => a.startsWith('--start-page='));
  if (!arg) return 0;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
})();
const END_PAGE = (() => {
  const arg = process.argv.find(a => a.startsWith('--end-page='));
  if (!arg) return 0;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
})();
const SPECIFIC_PAGE = (() => {
  const arg = process.argv.find(a => a.startsWith('--page='));
  if (!arg) return 0;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
})();
const PER_PAGE_MODE = process.argv.includes('--per-page');
if (IS_DRY_RUN) {
  log('🧪 Running in DRY RUN mode (OpenAI extraction calls will be skipped)');
}
if (MAX_CHUNKS > 0) {
  log(`🧪 Max chunk processing limit enabled: ${MAX_CHUNKS}`);
}
if (PER_PAGE_MODE) {
  log('🧾 Page-by-page extraction mode enabled');
}
if (SPECIFIC_PAGE > 0) {
  log(`🧾 Restricting to page ${SPECIFIC_PAGE}`);
}
if (!SPECIFIC_PAGE && START_PAGE > 0) {
  log(`🧾 Start page: ${START_PAGE}`);
}
if (!SPECIFIC_PAGE && END_PAGE > 0) {
  log(`🧾 End page: ${END_PAGE}`);
}

// Check OpenAI API key
console.log('🔑 OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing');
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment');
  console.error('Please add OPENAI_API_KEY to your .env.local file');
  console.error('Checked location:', path.join(__dirname, '..', '.env.local'));
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  maxRetries: 2
});
log('✅ OpenAI API key configured');

// Initialize Firebase
let firebaseOk = false;
try {
  const adminConfig: any = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.appspot.com',
  };

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminConfig.credential = cert(serviceAccount);
  }

  initializeApp(adminConfig);
  firebaseOk = true;
  log('✅ Firebase initialized');
} catch (error: any) {
  // Continue without Firestore
  log('⚠️ Firebase init error (continuing without Firestore):', error.message);
}

const db = firebaseOk ? getFirestore() : (null as any);

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  inStock: boolean;
  unit: string;
  code: string;
  image?: string;
  distributorName: string;
}

// Split text into chunks
function splitIntoChunks(text: string, maxChars: number = OPENAI_CHUNK_CHAR_LIMIT): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  const flushChunk = () => {
    const trimmed = currentChunk.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
    currentChunk = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r?$/, '');

    if (line.length > maxChars) {
      if (currentChunk.length > 0) {
        flushChunk();
      }
      for (let start = 0; start < line.length; start += maxChars) {
        chunks.push(line.slice(start, start + maxChars));
      }
      continue;
    }

    if (currentChunk.length + line.length + 1 > maxChars) {
      flushChunk();
    }

    currentChunk += line + '\n';
  }

  if (currentChunk.trim().length > 0) {
    flushChunk();
  }

  return chunks;
}

// Normalization helpers
const ABBREV_MAP: Record<string, string> = {
  'pkt': 'Packet', 'pkts': 'Packets', 'ctn': 'Carton', 'ctns': 'Cartons', 'pcs': 'Pieces', 'pc': 'Piece',
  'btl': 'Bottle', 'btls': 'Bottles', 'sct': 'Sachet', 'scts': 'Sachets', 'sachet': 'Sachet', 'pk': 'Pack', 'pks': 'Packs',
  'gm': 'Gram', 'gr': 'Gram', 'g': 'Gram', 'kg': 'Kilogram', 'ltr': 'Liter', 'lt': 'Liter', 'l': 'Liter', 'ml': 'Milliliter',
  'dz': 'Dozen', 'doz': 'Dozen', 'bag': 'Bag', 'bags': 'Bags', 'box': 'Box', 'boxes': 'Boxes', 'can': 'Can', 'cans': 'Cans'
};

function removeApostrophes(text: string): string {
  return (text || '').replace(/[’'`]/g, '');
}

function titleCasePreserveAcronyms(text: string): string {
  return (text || '')
    .split(/\s+/)
    .map((w) => {
      if (/^[A-Z0-9]{2,4}$/.test(w)) return w.toUpperCase();
      const lower = w.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .trim();
}

function expandAbbrevWord(word: string): string {
  const w = (word || '').toLowerCase();
  return ABBREV_MAP[w] || word;
}

function normalizeUnit(unit: string): string {
  if (!unit) return '';
  const clean = unit.trim().toLowerCase();
  const mapped = ABBREV_MAP[clean] || unit;
  return titleCasePreserveAcronyms(mapped);
}

// Build uniform name: "Brand Core Variant Size Unit"
function normalizeProductName(name: string, brand: string, description: string): string {
  let n = removeApostrophes(name || '').trim();
  let b = removeApostrophes(brand || '').trim();
  let d = removeApostrophes(description || '').trim();

  // Expand common abbrev in name/desc
  n = n.split(/\s+/).map(expandAbbrevWord).join(' ');
  d = d.split(/\s+/).map(expandAbbrevWord).join(' ');

  // Extract size like 10 kg, 500 ml, 1 L, etc.
  const sizeMatch = (n + ' ' + d).match(/(\d+[\.,]?\d*)\s*(milliliter|liter|kilogram|gram|ml|l|ltr|kg|g|gm|gr)\b/i);
  let sizeStr = '';
  if (sizeMatch) {
    let qty = sizeMatch[1].replace(',', '');
    let unit = sizeMatch[2].toLowerCase();
    unit = ABBREV_MAP[unit] ? ABBREV_MAP[unit] : unit;
    sizeStr = `${qty} ${titleCasePreserveAcronyms(unit)}`;
  }

  const cleanBrand = titleCasePreserveAcronyms(b);

  // Remove brand duplication from name if present
  let core = n.replace(new RegExp(`^${cleanBrand}\\b`, 'i'), '').trim();
  // Remove leading size/packaging from core
  core = core.replace(/^\d+[\.,]?\d*\s*(kg|g|gm|gr|ml|l|ltr|liter|milliliter|bottle|can|bag|carton|packet|pack|pcs|pieces|dozen)\b\s*/i, '').trim();

  // Title case core with acronym preservation
  core = titleCasePreserveAcronyms(core);

  const parts = [cleanBrand, core, sizeStr].filter(Boolean);
  let uniform = parts.join(' ').replace(/\s+/g, ' ').trim();
  uniform = removeApostrophes(uniform);
  return uniform;
}

// Utilities: ensure cache dir and read/write per-chunk cache
function ensureCacheDir(distributorId: string) {
  const dir = path.join(process.cwd(), 'data', '.extraction-cache', distributorId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function chunkCacheKey(content: string): string {
  return createHash('sha1').update(content).digest('hex').slice(0, 16);
}

function chunkCachePath(distributorId: string, chunkKey: string) {
  return path.join(ensureCacheDir(distributorId), `chunk-${chunkKey}.json`);
}

function writeChunkCache(distributorId: string, chunkKey: string, products: any[]) {
  const p = chunkCachePath(distributorId, chunkKey);
  fs.writeFileSync(p, JSON.stringify(products, null, 2), 'utf-8');
}

function readChunkCache(distributorId: string, chunkKey: string): any[] | null {
  const p = chunkCachePath(distributorId, chunkKey);
  if (fs.existsSync(p)) {
    try {
      const txt = fs.readFileSync(p, 'utf-8');
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }
  return null;
}

// Safely parse a JSON array from model output
function safeParseArray(text: string): any[] {
  let t = text.trim();
  // Strip markdown fences
  if (t.startsWith('```')) t = t.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
  // Try to find array boundaries
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  // Remove trailing commas before ] or }
  t = t.replace(/,\s*([\]\}])/g, '$1');
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      // If object with a single array property
      const firstKey = Object.keys(parsed)[0];
      const val = (parsed as any)[firstKey];
      if (Array.isArray(val)) return val;
    }
  } catch (_) {
    // fallthrough
  }
  return [];
}

// Extract products from text using OpenAI (batch processing for efficiency)
async function extractProductsFromText(
  text: string,
  distributorName: string,
  distributorId: string,
  batchSize: number = 50
): Promise<Product[]> {
  // Split into manageable chunks to avoid token limits
  let chunks = splitIntoChunks(text, OPENAI_CHUNK_CHAR_LIMIT);
  log(`\n🤖 Using OpenAI to extract products from ${chunks.length} chunks (≈${OPENAI_CHUNK_CHAR_LIMIT} chars max each)...`);
  
  let allProducts: any[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    if (MAX_CHUNKS > 0 && i >= MAX_CHUNKS) {
      log(`\n   🛑 Reached max chunk limit (${MAX_CHUNKS}); skipping remaining ${chunks.length - i} chunks.`);
      break;
    }
    const chunkText = chunks[i];
    const chunkKey = chunkCacheKey(chunkText);
    log(`\n   📝 Processing chunk ${i + 1}/${chunks.length} (${chunkText.length} chars, key ${chunkKey})...`);

    // If cached, reuse
    const cached = readChunkCache(distributorId, chunkKey);
    if (cached && cached.length > 0) {
      log(`   🔁 Using cached result for chunk ${i + 1} (${cached.length} products)`);
      allProducts.push(...cached);
      log(`   📈 Total so far: ${allProducts.length} products`);
      if (i < chunks.length - 1) {
        console.log(`   ⏳ Waiting 0.5s before next chunk...`);
        await new Promise(r => setTimeout(r, 500));
      }
      continue;
    }

    if (IS_DRY_RUN) {
      log(`   🧪 Dry run active: skipping API call for chunk ${i + 1} (no cache available).`);
      continue;
    }
    
    const prompt = `You are an intelligent product data specialist. Your job is to read, understand, and intelligently format product information from distributor pricelists.

DISTRIBUTOR: ${distributorName}
CHUNK: ${i + 1}/${chunks.length}

PRICELIST TEXT:
${chunkText}

🎯 YOUR MISSION: Think like a human organizing a retail catalog. Read each product, understand what it actually is, and format it professionally.

📋 INTELLIGENT EXTRACTION RULES:

1. **UNDERSTAND & CLEAN PRODUCT NAMES**
   - Spell out ALL abbreviations and shortcuts
   - Remove apostrophes and special characters from names
   - Make names clear and professional
   
   Examples:
   ❌ "KIDS S/BRY 200MLX24" 
   ✅ "Kids Strawberry Juice 200ml" (24-pack carton)
   
   ❌ "KIDS BLK CURRNT 200MLX24"
   ✅ "Kids Black Currant Juice 200ml" (24-pack carton)
   
   ❌ "TETRA APPLE 250MLX24***"
   ✅ "Tetra Apple Juice 250ml" (24-pack carton)
   
   ❌ "10KG ABABIL PK 386 PARBOILED RICE"
   ✅ "Ababil PK 386 Parboiled Rice 10kg" (keep numeric part of product code like PK 386)

2. **EXTRACT TRUE BRAND NAMES**
   - The brand is the company/manufacturer name, NOT the size
   - Look for the actual brand in the product name
   
   Examples:
   ❌ "10KG" or "KG" or "200ML" are NOT brands
   ✅ "Ababil", "Coca Cola", "Fzami", "Kids", "Tetra" are brands
   
   For "10KG ABABIL PK 386 RICE" → brand: "Ababil"
   For "KIDS APPLE 200MLX24" → brand: "Kids"
   For "RTD 1.5LTRX6 TROPICAL" → brand: "RTD"

3. **CREATE PROFESSIONAL NAMES**
   Format: [Brand] [Product Type] [Flavor/Variety] [Size]
   
   Examples:
   - "Kids Apple Juice 200ml"
   - "Ababil Basmati Rice 10kg"
   - "Coca Cola Original 500ml"
   - "Dettol Antibacterial Soap 175g"
   - "Blue Band Margarine 500g"
   
   NO apostrophes, NO abbreviations like "S/BRY", NO "X24" in the name (that goes in description)

4. **DETAILED DESCRIPTIONS**
   Include ALL relevant details:
   - Full size and packaging (e.g., "24-pack carton of 200ml bottles")
   - Flavor, variety, or type
   - Any special features
   
   Example: "Kids brand strawberry flavored juice drink, 200ml individual packs, sold as 24-pack carton"

5. **SMART UNIT EXTRACTION**
   - Look at the actual unit being sold
   - "200MLX24" → unit: "CTN" (it's a carton of 24)
   - "10KG" → unit: "BAG" (if it's a bag)
   - "500ML" bottle → unit: "PCS" (individual piece)

6. **CATEGORIES - Think About What It Is**
   - beverages: Any drinks (juice, soda, water, etc.)
   - food: Snacks, canned goods, packaged foods
   - grains: Rice, flour, cereals, beans
   - oils: Cooking oils, ghee
   - dairy: Milk, cheese, yogurt, butter
   - personal-care: Soap, shampoo, lotion, toothpaste
   - cleaning: Detergents, cleaners, bleach
   - general: If you're not sure

7. **FILTER OUT JUNK**
   Skip these completely:
   - Page numbers, headers, footers
   - Lines like "PRODUCT", "PRICE", "TOTAL"
   - Category headers
   - Anything that's not an actual product

🎯 OUTPUT FORMAT: JSON array with these fields:
- code: product code (string)
- name: Clean, professional product name with NO abbreviations, NO apostrophes
- description: Full detailed description with packaging info
- brand: Actual brand name (NOT a size or quantity)
- unit: CTN, BAG, PCS, KG, L, etc.
- price: Number only
- category: beverages, food, grains, oils, dairy, personal-care, cleaning, or general

EXAMPLE - BEFORE AND AFTER:
RAW TEXT:
"KK061ACACIA | KIDS APPLE 200MLX24 | 940"
"KK062ACACIA | KIDS BLK CURRNT 200MLX24 | 940"
"110 | 10KG ABABIL PK 386 PARBOILED RICE | 1295"
"KK049AFIA | RTD 1.5LTRX6 TROPICAL | 915"

INTELLIGENT OUTPUT:
[
  {
    "code": "KK061ACACIA",
    "name": "Kids Apple Juice 200ml",
    "description": "Kids brand apple flavored juice drink in 200ml individual packs, sold as 24-pack carton. Perfect for children's lunchboxes and parties.",
    "brand": "Kids",
    "unit": "CTN",
    "price": 940,
    "category": "beverages"
  },
  {
    "code": "KK062ACACIA",
    "name": "Kids Black Currant Juice 200ml",
    "description": "Kids brand black currant flavored juice drink in 200ml individual packs, sold as 24-pack carton. Rich fruity flavor.",
    "brand": "Kids",
    "unit": "CTN",
    "price": 940,
    "category": "beverages"
  },
  {
    "code": "110",
    "name": "Ababil PK 386 Parboiled Rice 10kg",
    "description": "Ababil brand PK 386 variety parboiled rice in 10kg bag. Premium quality long-grain rice ideal for biryani and daily cooking.",
    "brand": "Ababil",
    "unit": "BAG",
    "price": 1295,
    "category": "grains"
  },
  {
    "code": "KK049AFIA",
    "name": "RTD Tropical Juice 1.5L",
    "description": "RTD brand tropical flavored juice drink in 1.5 liter bottles, sold as 6-pack carton. Refreshing mixed fruit flavor.",
    "brand": "RTD",
    "unit": "CTN",
    "price": 915,
    "category": "beverages"
  }
]

🎯 KEY POINTS:
- Spell everything out: "S/BRY" → "Strawberry", "BLK CURRNT" → "Black Currant"
- No abbreviations in names
- No apostrophes or special characters in names
- Brand is the manufacturer, not the size
- Clean, uniform, professional formatting
- Detailed descriptions explain packaging

RETURN ONLY THE JSON ARRAY. NO markdown, NO explanations, NO code blocks - just pure JSON.`;
    
    // Call OpenAI with retries and lower max_tokens
    let success = false;
    let attempt = 0;
    let lastError: any = null;
    let progressInterval: NodeJS.Timeout | null = null;
    
    while (!success && attempt < 3) {
      attempt++;
      try {
        log(`   🤖 Calling OpenAI API (attempt ${attempt})...`);
        log(`      ⏱️  Large chunks may take 30-120 seconds, please wait...`);
        const startTime = Date.now();
        
        // Show progress every 15 seconds
        progressInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          log(`      ⏳ Still processing... (${elapsed}s elapsed)`);
        }, 15000);
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'You are an intelligent product catalog specialist. Your job is to understand raw product data and intelligently format it into clean, professional product listings. Expand abbreviations, spell out shortcuts, and create uniform, professional product names. Return only valid JSON arrays.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3, // Slightly higher for more intelligent reformatting
          max_tokens: OPENAI_MAX_OUTPUT_TOKENS
        });
        
        if (progressInterval) clearInterval(progressInterval);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const inputTokens = response.usage?.prompt_tokens || 0;
        const outputTokens = response.usage?.completion_tokens || 0;
    totalPromptTokens += inputTokens;
    totalCompletionTokens += outputTokens;
    log(`   ✅ Got response (${duration}s, ${inputTokens} in + ${outputTokens} out)`);

        const content = response.choices[0].message.content?.trim() || '';
    log(`   📊 Parsing JSON response...`);
        const chunkProducts = safeParseArray(content);
    log(`   ✅ Extracted ${chunkProducts.length} products from chunk ${i + 1}`);

        // Sample
        if (chunkProducts.length > 0) {
          log(`   📦 Sample products:`);
          chunkProducts.slice(0, 3).forEach((p: any) => {
            log(`      - ${p.name} (${p.code}) - KES ${p.price}`);
          });
        }

        // Cache result and accumulate
        writeChunkCache(distributorId, chunkKey, chunkProducts);
        allProducts.push(...chunkProducts);
        log(`   📈 Total so far: ${allProducts.length} products`);

        // Throttle a bit
        if (i < chunks.length - 1) {
          log(`   ⏳ Waiting 0.8s before next chunk...`);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        success = true;
      } catch (error: any) {
        if (progressInterval) clearInterval(progressInterval);
        lastError = error;
        log(`   ❌ Attempt ${attempt} failed: ${error?.message || error}`);
        log(`   Error type: ${error?.constructor?.name || typeof error}`);
        if (error?.code) log(`   Error code: ${error.code}`);
        if (error?.status) log(`   HTTP Status: ${error.status}`);
        if (error?.response) {
          log(`   API Status: ${error.response.status}`);
          log(`   API Error: ${JSON.stringify(error.response.data)}`);
        }
        if (error?.stack) log(`   Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        if (attempt < 3) {
          const backoff = 2000 * attempt;
          log(`   🔁 Retrying in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }

    if (!success) {
      const shouldRetrySmaller = chunkText.length > RETRY_SPLIT_CHUNK_LIMIT;
      if (shouldRetrySmaller) {
        log(`   ✂️ Splitting chunk ${i + 1} into smaller parts (retry limit ${RETRY_SPLIT_CHUNK_LIMIT} chars)...`);
        const smallerChunks = splitIntoChunks(chunkText, RETRY_SPLIT_CHUNK_LIMIT);
        if (smallerChunks.length > 1) {
          chunks.splice(i, 1, ...smallerChunks);
          i--;
          log(`   🔁 Re-queued ${smallerChunks.length} smaller chunks.`);
          continue;
        }
      }
      log(`   🚫 Skipping chunk ${i + 1} after 3 failed attempts.`);
      if (lastError) log(`   Last error: ${lastError?.message || lastError}`);
    }
  }
  
  log(`\n✅ Total extracted: ${allProducts.length} products from ${chunks.length} chunks`);
  log(`📊 Extraction complete for ${distributorName}`);
  
  // Cost based on actual usage (best-effort)
  const inputCost = (totalPromptTokens / 1_000_000) * 0.150;
  const outputCost = (totalCompletionTokens / 1_000_000) * 0.600;
  const totalCost = inputCost + outputCost;
  log(`💰 Estimated actual cost for ${distributorName}: $${totalCost.toFixed(4)} (tokens: ${totalPromptTokens} in + ${totalCompletionTokens} out)`);
  
  return allProducts;
}

// Fetch image URLs from Firebase
async function fetchImageUrls(distributorId: string): Promise<Map<string, string>> {
  log(`\n🔍 Fetching generated images from Firebase for ${distributorId}...`);
  
  try {
    if (!db) {
      log('⚠️ Firestore not initialized, skipping image fetch');
      return new Map();
    }
    const snapshot = await db.collection('distributor_images')
      .where('distributorId', '==', distributorId)
      .get();

    const imageMap = new Map<string, string>();
    
    snapshot.forEach((doc: any) => {
        const data = doc.data();
        const url: string | undefined = data.imageUrl || data.url || data.image || data.imageURL;
        const rawNames: any[] = [data.productName, data.name, data.normalizedName];
        const keys: string[] = [];
        for (const rn of rawNames) {
            if (!rn) continue;
            const k: string = String(rn).toLowerCase().trim();
            if (k && !keys.includes(k)) keys.push(k);
            const kNoApos: string = k.replace(/[’'`]/g, '');
            if (kNoApos && !keys.includes(kNoApos)) keys.push(kNoApos);
        }
        if (url) {
            for (const k of keys) {
                imageMap.set(k, url);
            }
        }
    });

    log(`✅ Found ${imageMap.size} generated images`);
    return imageMap;
  } catch (error) {
    log('❌ Firebase fetch error:', (error as any)?.message || error);
    return new Map();
  }
}

// Match product to image URL
function matchImageUrl(productName: string, imageMap: Map<string, string>): string | undefined {
  const normalized = productName.toLowerCase().trim();
  
  // Try exact match
  if (imageMap.has(normalized)) {
    return imageMap.get(normalized);
  }
  
  // Try fuzzy match
  for (const [key, url] of imageMap.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return url;
    }
  }
  
  return undefined;
}

// Generate TypeScript file for distributor
function generateDistributorFile(
  distributorName: string,
  products: Product[],
  outputPath: string
) {
  const categories = [...new Set(products.map(p => p.category))].sort();
  
  const fileContent = `// ${distributorName} Products
// Auto-generated on ${new Date().toISOString()}
// Source: TXT pricelist via OpenAI + Firebase image URLs

import type { Product } from "@/lib/types"

export const ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products: Product[] = ${JSON.stringify(products, null, 2)};

// Category list
export const categories = ${JSON.stringify(categories, null, 2)};

// Helper functions
export function getProductById(id: number): Product | undefined {
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.find(p => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p => p.category === category);
}

export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase();
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.brand.toLowerCase().includes(lowerQuery) ||
    p.code.includes(lowerQuery)
  );
}

export function filterByPrice(min: number, max: number): Product[] {
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p => 
    p.price >= min && p.price <= max
  );
}

export function filterProducts(filters: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  brand?: string;
}): Product[] {
  let filtered = ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products;
  
  if (filters.category) {
    filtered = filtered.filter(p => p.category === filters.category);
  }
  
  if (filters.minPrice !== undefined) {
    filtered = filtered.filter(p => p.price >= filters.minPrice!);
  }
  
  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice!);
  }
  
  if (filters.inStock !== undefined) {
    filtered = filtered.filter(p => p.inStock === filters.inStock);
  }
  
  if (filters.brand) {
    filtered = filtered.filter(p => p.brand.toLowerCase() === filters.brand!.toLowerCase());
  }
  
  return filtered;
}

// Statistics
export const stats = {
  total: ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.length,
  withImages: ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p => p.image).length,
  categories: categories.length,
  brands: [...new Set(${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.map(p => p.brand))].length,
  avgPrice: ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.reduce((sum, p) => sum + p.price, 0) / ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.length,
  minPrice: Math.min(...${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.map(p => p.price)),
  maxPrice: Math.max(...${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.map(p => p.price))
};
`;

  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`✅ Generated: ${outputPath}`);
}

// Process distributor
async function processDistributor(
  distributorName: string,
  distributorId: string,
  textPath: string
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Processing: ${distributorName}`);
  console.log('='.repeat(60));

  // 1. Read extracted text from PDF
  if (!fs.existsSync(textPath)) {
    console.error(`❌ TXT pricelist file not found: ${textPath}`);
    return;
  }

  const pdfText = fs.readFileSync(textPath, 'utf-8');
  console.log(`✅ Loaded TXT pricelist (${pdfText.length} characters)`);

  // 2. Extract products using OpenAI
  const extractedProducts = await extractProductsFromText(pdfText, distributorName, distributorId);
  
  if (extractedProducts.length === 0) {
    if (IS_DRY_RUN) {
      console.warn(`⚠️ Dry run: No products extracted for ${distributorName} (expected)`);
      return;
    }
    console.error(`❌ No products extracted for ${distributorName}`);
    return;
  }

  // 3. Fetch image URLs from Firebase
  const imageMap = await fetchImageUrls(distributorId);

  // 4. Format products and apply additional filtering & cleaning
  const formattedProducts: Product[] = extractedProducts
    .filter(p => {
      // Additional validation to remove junk entries
      const name = p.name?.trim() || '';
      const brand = p.brand?.trim() || '';
      
      // Skip if name is too short or invalid
      if (name.length < 3) return false;
      
      // Skip if it looks like a header, footer, or non-product
      const invalidPatterns = [
        /^(page|total|subtotal|grand|category|section|product|price|code|name|brand|unit)/i,
        /^-+$/,
        /^\d+$/,  // Just numbers
        /^(category|section):/i,
        /price\s*list/i,
        /^\s*$/
      ];
      
      if (invalidPatterns.some(pattern => pattern.test(name))) return false;
      
      // Skip if brand looks invalid (size/weight instead of brand)
      const invalidBrands = /^(\d+\s*(kg|g|ml|l|ltr|litre|pcs|ctn|x\d+))/i;
      if (invalidBrands.test(brand)) return false;
      
      // Skip if brand is a common abbreviation that should have been spelled out
      const commonAbbreviations = /^(s\/bry|blk|currnt|raspbry|strwbry)$/i;
      if (commonAbbreviations.test(brand)) return false;
      
      // Must have a valid price
      if (!p.price || p.price <= 0 || p.price > 1000000) return false;
      
      return true;
    })
    .map((p, index) => {
      const imageUrl = matchImageUrl(p.name, imageMap);

      // Post-normalize
      const cleanBrand = titleCasePreserveAcronyms(removeApostrophes(p.brand || '').trim());
      const cleanName = normalizeProductName(p.name || '', cleanBrand, p.description || '');
      const unitNorm = normalizeUnit((p.unit || '').toString());

      // Numeric price only
      const priceNum = Number(String(p.price).replace(/[^0-9.]/g, ''));

      return {
        id: index + 1,
        name: cleanName,
        description: removeApostrophes(p.description || '').trim(),
        price: priceNum,
        category: (p.category || 'general').toLowerCase(),
        brand: cleanBrand,
        inStock: true,
        unit: unitNorm,
        code: p.code,
        image: imageUrl,
        distributorName: distributorName
      };
    });

  // 5. Generate TypeScript file
  const outputDir = path.join(process.cwd(), 'data', 'distributors');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(
    outputDir,
    `${distributorName.toLowerCase().replace(/\s+/g, '-')}-products.ts`
  );

  generateDistributorFile(distributorName, formattedProducts, outputPath);

  // 6. Print summary
  log(`\n📊 ${distributorName} Summary:`);
  log(`   Total products: ${formattedProducts.length}`);
  log(`   With images: ${formattedProducts.filter(p => p.image).length}`);
  log(`   Categories: ${new Set(formattedProducts.map(p => p.category)).size}`);
  if (formattedProducts.length) {
    log(`   Price range: KES ${Math.min(...formattedProducts.map(p => p.price))} - KES ${Math.max(...formattedProducts.map(p => p.price))}`);
    log(`   Image coverage: ${((formattedProducts.filter(p => p.image).length / formattedProducts.length) * 100).toFixed(1)}%`);
  }
}

// Main function
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 ENHANCED OpenAI PDF Product Extraction');
  console.log('='.repeat(70));
  console.log('\nImprovements in this version:');
  console.log('✅ Better brand extraction (e.g., "Ababil" not "KG")');
  console.log('✅ Title Case names (not ALL CAPS)');
  console.log('✅ Single price field (removed wholesalePrice)');
  console.log('✅ Enhanced filtering to remove junk entries');
  console.log('✅ More detailed product descriptions');
  console.log('✅ Better validation and data cleaning\n');
  
  // Cost estimate
  console.log('💰 ESTIMATED COST (GPT-4o-mini):');
  console.log('   - Input: $0.150 per 1M tokens');
  console.log('   - Output: $0.600 per 1M tokens');
  console.log('   - For ~7,000 products: ~$0.30-0.50 USD');
  console.log('   (Actual cost shown after extraction)\n');

  const dataDir = path.join(process.cwd(), 'data');

  // Helper: find the newest TXT file matching a pattern
  function findLatestTxt(patterns: RegExp[]): string | null {
    if (!fs.existsSync(dataDir)) return null;
    const files = fs.readdirSync(dataDir)
      .filter(f => f.toLowerCase().endsWith('.txt'))
      .map(f => ({
        name: f,
        full: path.join(dataDir, f),
        mtime: fs.statSync(path.join(dataDir, f)).mtimeMs
      }));
    const matched = files.filter(f => patterns.some(p => p.test(f.name)));
    if (matched.length === 0) return null;
    matched.sort((a, b) => b.mtime - a.mtime);
    return matched[0].full;
  }

  // Clear cache option (uncomment to re-extract everything)
  const clearCache = process.argv.includes('--clear-cache');
  if (clearCache) {
    console.log('🗑️  Clearing extraction cache...');
    const cacheDir = path.join(process.cwd(), 'data', '.extraction-cache');
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('✅ Cache cleared\n');
    }
  }

  // Process Sam West from latest TXT pricelist
  console.log('\n📦 PROCESSING SAM WEST...');
  const samWestTxt = findLatestTxt([
    /sam\s*west/i,
    /sam[-_\s]?west[-_\s]?.*pricelist/i
  ]) || path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt');
  console.log(`📄 Using TXT: ${samWestTxt}`);
  await processDistributor(
    'Sam West',
    'sam-west',
    samWestTxt
  );

  // Process Mahitaji from latest TXT pricelist
  console.log('\n📦 PROCESSING MAHITAJI...');
  const mahitajiTxt = findLatestTxt([
    /mahitaji/i,
    /mahitaji[-_\s]?.*pricelist/i
  ]) || path.join(dataDir, 'mahitaji pricelist_extracted_text.txt');
  console.log(`📄 Using TXT: ${mahitajiTxt}`);
  await processDistributor(
    'Mahitaji',
    'mahitaji',
    mahitajiTxt
  );

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL DISTRIBUTORS PROCESSED SUCCESSFULLY!');
  console.log('='.repeat(70));
  if (IS_DRY_RUN) {
    console.log('\n🧪 Dry run: No distributor files were generated.');
  } else {
    console.log('\n📝 Generated files:');
    console.log('   - data/distributors/sam-west-products.ts');
    console.log('   - data/distributors/mahitaji-products.ts');
  }
  console.log('\n📝 Next steps:');
  console.log('   1. Review the generated files for data quality');
  console.log('   2. Run image generation for products missing images');
  console.log('   3. Update distributor-data.ts to import these files');
  console.log('   4. Test in the supplier module');
  console.log('\n💡 Tip: Run with --clear-cache flag to re-extract from scratch');
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
