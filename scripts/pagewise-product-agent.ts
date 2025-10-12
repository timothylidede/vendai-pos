/**
 * Pagewise Product Extraction Agent
 * Sequentially processes distributor TXT pricelists page by page, extracts
 * structured product data with OpenAI, and updates distributor product files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { createHash } from 'crypto';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// __dirname emulation
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

// Logging utilities
const LOG_DIR = path.join(process.cwd(), 'data', '.agent-logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_PATH = path.join(LOG_DIR, `page-agent-${RUN_ID}.log`);
function log(...args: any[]) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  try { fs.appendFileSync(LOG_PATH, msg + '\n', 'utf-8'); } catch {}
  console.log(msg);
}

// CLI argument parsing
interface AgentArgs {
  txtPath: string;
  distributorName: string;
  distributorId: string;
  outputPath: string;
  startPage: number;
  endPage: number;
  maxPages: number;
  resume: boolean;
  dryRun: boolean;
  temperature: number;
  maxTokens: number;
  retries: number;
  maxItems: number;
}

function parseArgs(): AgentArgs {
  const argv = process.argv.slice(2);
  const getValue = (key: string, fallback: string = '') => {
    const arg = argv.find(a => a.startsWith(`${key}=`));
    if (!arg) return fallback;
    return arg.split('=')[1];
  };
  const hasFlag = (flag: string) => argv.includes(flag);

  const args: AgentArgs = {
    txtPath: getValue('--txt'),
    distributorName: getValue('--distributor'),
    distributorId: getValue('--id'),
    outputPath: getValue('--output'),
    startPage: Number(getValue('--start-page', '0')) || 0,
    endPage: Number(getValue('--end-page', '0')) || 0,
    maxPages: Number(getValue('--max-pages', '0')) || 0,
    resume: hasFlag('--resume'),
    dryRun: hasFlag('--dry-run') || process.env.OPENAI_PAGE_AGENT_DRY_RUN === '1',
    temperature: Number(getValue('--temperature', '0')) || 0,
    maxTokens: Number(getValue('--max-tokens', '4000')) || 4000,
    retries: Number(getValue('--retries', process.env.OPENAI_PAGE_AGENT_RETRIES || '3')) || 3,
    maxItems: Number(getValue('--max-items', '25')) || 25,
  };

  if (!args.txtPath) throw new Error('Missing required --txt argument (path to TXT pricelist).');
  if (!args.distributorName) throw new Error('Missing required --distributor argument.');
  if (!args.distributorId) throw new Error('Missing required --id argument.');
  if (!args.outputPath) {
    args.outputPath = path.join(
      process.cwd(),
      'data',
      'distributors',
      `${args.distributorName.toLowerCase().replace(/\s+/g, '-')}-products.ts`
    );
  }

  return args;
}

const args = parseArgs();
log('🚀 Pagewise Product Extraction Agent');
log(`   Distributor : ${args.distributorName} (${args.distributorId})`);
log(`   Source Path : ${args.txtPath}`);
log(`   Output Path : ${args.outputPath}`);
if (args.startPage) log(`   Start Page  : ${args.startPage}`);
if (args.endPage) log(`   End Page    : ${args.endPage}`);
if (args.maxPages) log(`   Max Pages   : ${args.maxPages}`);
if (args.resume) log('   Resume mode : enabled');
if (args.dryRun) log('   Dry run     : enabled (no OpenAI calls)');

// Validate OpenAI key
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY missing in environment (.env.local).');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: Number(process.env.OPENAI_AGENT_TIMEOUT_MS || 300000),
});

async function loadPricelistText(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Pricelist file not found: ${filePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    const text = result.text || '';
    if (!text.trim()) {
      throw new Error('PDF parsed successfully but returned empty text.');
    }
    return text;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Firebase initialization (optional)
let db: ReturnType<typeof getFirestore> | null = null;
try {
  if (!getApps().length) {
    const firebaseConfig: any = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.appspot.com',
    };
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      firebaseConfig.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
    }
    initializeApp(firebaseConfig);
  }
  db = getFirestore();
  log('✅ Firestore ready for image lookups');
} catch (error: any) {
  log('⚠️ Firestore init skipped:', error?.message || error);
}

// Types & helpers
interface RawProduct {
  code: string;
  name: string;
  description: string;
  brand: string;
  unit: string;
  price: number | string;
  category: string;
  image?: string;
}

interface Product extends RawProduct {
  id: number;
  inStock: boolean;
  distributorName: string;
}

interface ParseArrayResult {
  items: RawProduct[];
  error?: string;
}

const ABBREV_MAP: Record<string, string> = {
  'pkt': 'Packet', 'pkts': 'Packets', 'ctn': 'Carton', 'ctns': 'Cartons',
  'pcs': 'Pieces', 'pc': 'Piece', 'btl': 'Bottle', 'btls': 'Bottles',
  'sct': 'Sachet', 'scts': 'Sachets', 'pk': 'Pack', 'pks': 'Packs',
  'gm': 'Gram', 'gr': 'Gram', 'g': 'Gram', 'kg': 'Kilogram',
  'ltr': 'Liter', 'lt': 'Liter', 'l': 'Liter', 'ml': 'Milliliter',
  'dz': 'Dozen', 'doz': 'Dozen', 'bag': 'Bag', 'bags': 'Bags',
  'box': 'Box', 'boxes': 'Boxes', 'can': 'Can', 'cans': 'Cans'
};

const NAME_UNIT_MAP: Record<string, string> = {
  KILOGRAM: 'KG',
  KILOGRAMS: 'KG',
  GRAM: 'G',
  GRAMS: 'G',
  LITER: 'L',
  LITERS: 'L',
  LITRE: 'L',
  LITRES: 'L',
  MILLILITER: 'ML',
  MILLILITERS: 'ML',
  MILLILITRE: 'ML',
  MILLILITRES: 'ML',
  BOTTLE: 'BTL',
  BOTTLES: 'BTLS',
  CARTON: 'CTN',
  CARTONS: 'CTNS',
  PACKET: 'PKT',
  PACKETS: 'PKTS',
  PIECE: 'PC',
  PIECES: 'PCS',
  DOZEN: 'DOZ'
};

function removeApostrophes(text: string): string {
  return (text || '').replace(/[’'`]/g, '');
}

function titleCasePreserveAcronyms(text: string): string {
  return (text || '')
    .split(/\s+/)
    .map(word => {
      if (/^[A-Z0-9]{2,4}$/.test(word)) return word.toUpperCase();
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .trim();
}

function expandAbbrevWord(word: string): string {
  const lower = (word || '').toLowerCase();
  return ABBREV_MAP[lower] || word;
}

function normalizeUnit(unit: string): string {
  if (!unit) return '';
  return removeApostrophes(unit.trim()).replace(/\s+/g, ' ').toUpperCase();
}

function normalizeProductName(name: string): string {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ').toUpperCase();
  normalized = normalized.replace(/(\d+[\d\.\/]*)\s+(KILOGRAMS?|GRAMS?|LITRES?|LITERS?|MILLILITRES?|MILLILITERS?)/g, (_, qty: string, unit: string) => {
    const abbr = NAME_UNIT_MAP[unit.toUpperCase()] || unit.toUpperCase();
    return `${qty}${abbr}`;
  });
  normalized = normalized.replace(/\b(KILOGRAMS?|GRAMS?|LITRES?|LITERS?|MILLILITRES?|MILLILITERS?)\b/g, match => NAME_UNIT_MAP[match] || match);
  return normalized;
}

function slugifyForCode(text: string): string {
  return (text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildStableProductCode(rawCode: string, cleanBrand: string, cleanName: string, unit: string): string {
  const normalizedRaw = slugifyForCode(rawCode);
  const hasLetters = /[A-Z]/.test(normalizedRaw);
  const isStrong = normalizedRaw.length >= 4 && hasLetters;
  if (isStrong) {
    return normalizedRaw;
  }

  const parts = [cleanBrand, cleanName, unit]
    .map(slugifyForCode)
    .filter(Boolean);
  const base = parts.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const hash = createHash('sha1')
    .update(`${cleanBrand}|${cleanName}|${unit}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  const candidate = `${base}-${hash}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
  const clipped = candidate.slice(0, 48);
  return clipped || `PRODUCT-${hash}`;
}

function safeParseArray(text: string): ParseArrayResult {
  let t = (text || '').trim();
  if (!t) return { items: [] };
  // Strip code fences and any non-JSON leading/trailing text
  t = t.replace(/```json[\s\S]*?```/gi, (m) => m.replace(/```json|```/gi, '').trim());
  if (t.startsWith('```')) t = t.replace(/```[a-z]*\n?|```/gi, '').trim();

  // Extract the first top-level JSON array if present
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  // Remove trailing commas before ] or }
  t = t.replace(/,\s*([\]\}])/g, '$1');

  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return { items: parsed };
    const firstKey = Object.keys(parsed)[0];
    const val = (parsed as any)[firstKey];
    if (Array.isArray(val)) return { items: val };
    return { items: [] };
  } catch (error: any) {
    const message = error?.message || String(error);
    log('⚠️ JSON parse failed:', message);
    return { items: [], error: message };
  }
}

function recoverProductsFromPartialJson(text: string): RawProduct[] {
  const start = text.indexOf('[');
  if (start === -1) return [];
  const scope = text.slice(start);
  const products: RawProduct[] = [];
  let collecting = false;
  let depth = 0;
  let buffer = '';
  let inString = false;
  let escape = false;
  for (const char of scope) {
    if (!collecting) {
      if (char === '{') {
        collecting = true;
        depth = 1;
        buffer = '{';
      }
      continue;
    }

    buffer += char;

    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') {
      depth++;
      continue;
    }
    if (char === '}') {
      depth--;
      if (depth === 0) {
        const candidate = buffer.trim();
        try {
          const json = candidate.endsWith(',') ? candidate.slice(0, -1) : candidate;
          const parsed = JSON.parse(json);
          products.push(parsed as RawProduct);
        } catch (error: any) {
          log('⚠️ Failed to recover object from partial JSON:', error?.message || error);
        }
        collecting = false;
        buffer = '';
      }
      continue;
    }

    if (depth === 0 && (char === ',' || char === ']')) {
      collecting = false;
      buffer = '';
    }
  }
  return products;
}

function ensureCacheDir(distributorId: string) {
  const dir = path.join(process.cwd(), 'data', '.page-agent-cache', distributorId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cachePath(distributorId: string, pageNumber: number) {
  return path.join(ensureCacheDir(distributorId), `page-${String(pageNumber).padStart(3, '0')}.json`);
}

function loadPageCache(distributorId: string, pageNumber: number): RawProduct[] | null {
  const file = cachePath(distributorId, pageNumber);
  if (!fs.existsSync(file)) return null;
  try {
    const txt = fs.readFileSync(file, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function savePageCache(distributorId: string, pageNumber: number, products: RawProduct[]) {
  const file = cachePath(distributorId, pageNumber);
  fs.writeFileSync(file, JSON.stringify(products, null, 2), 'utf-8');
}

function saveRawResponse(distributorId: string, pageNumber: number, raw: string) {
  const dir = ensureCacheDir(distributorId);
  const file = path.join(dir, `page-${String(pageNumber).padStart(3, '0')}-raw.txt`);
  try {
    fs.writeFileSync(file, raw, 'utf-8');
  } catch {}
}

function splitSamWestPages(text: string): string[] {
  const footerRegex = /\nPage\d+.*?(?:Printed by SAP Business One)?\s*/g;
  const pages: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = footerRegex.exec(text)) !== null) {
    const chunk = text.slice(lastIndex, match.index).trim();
    if (chunk) pages.push(chunk);
    lastIndex = footerRegex.lastIndex;
  }
  const finalChunk = text.slice(lastIndex).trim();
  if (finalChunk) pages.push(finalChunk);
  return pages;
}

function splitByLength(text: string, maxChars: number = 1800, maxLines: number = 70): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trimEnd());
  const pages: string[] = [];
  let current: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    current.push(line);
    const currentText = current.join('\n');
    if (currentText.length >= maxChars || current.length >= maxLines) {
      pages.push(currentText.trim());
      current = [];
    }
  }
  if (current.length) {
    pages.push(current.join('\n').trim());
  }
  return pages;
}

function splitMahitajiPages(text: string): string[] {
  const cleaned = text
    .replace(/MAHITAJI ENTERPRISES LTD/gi, '')
    .replace(/Price List/gi, '')
    .replace(/\[ AsOnDate to .*?\]/gi, '')
    .replace(/CodeItemUnitP7/gi, '')
    .trim();
  if (!cleaned) return [];
  return splitByLength(cleaned, 1600, 60);
}

function splitIntoPages(text: string): string[] {
  if (/Printed by SAP Business One/.test(text)) {
    return splitSamWestPages(text);
  }
  if (/MAHITAJI ENTERPRISES LTD/i.test(text)) {
    return splitMahitajiPages(text);
  }
  return splitByLength(text, 1800, 70);
}

function cleanSamWestPage(page: string, processedCount: number): string {
  const stripped = page
    .replace(/Date\d{2}\/\d{2}\/\d{4}/g, '')
    .replace(/Time\d{2}:\d{2}/g, '')
    .replace(/ContinueSUPERMARKET PRICELIST/g, '')
    .replace(/SUPERMARKET PRICELIST/g, '')
    .replace(/#DescriptionBUYING PRICEUNIT/g, '')
    .replace(/\n\s*Page\d+.*/g, '')
    .replace(/Printed by SAP Business One/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  let runningIndex = processedCount;

  const lines = stripped
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const csvLines = lines.map(line => {
    if (/^#\s*Description/i.test(line)) {
      return 'description,buying_price,unit';
    }

    if (/^PERMARKET PRICEL/i.test(line)) {
      return '';
    }

    const kesIndex = line.toUpperCase().lastIndexOf('KES');
    if (kesIndex === -1) return line;

  const beforePrice = line.slice(0, kesIndex).trim();
    const afterPriceRaw = line.slice(kesIndex + 3).trim();
    if (!beforePrice || !afterPriceRaw) return line;

    const afterParts = afterPriceRaw.split(/\s+/);
    if (afterParts.length === 0) return line;
    const unit = afterParts.pop() || '';
    const priceValue = afterParts.join(' ').trim();
    const price = priceValue ? `KES ${priceValue}` : 'KES 0';

    const beforeMatch = beforePrice.match(/^(\d+)(.*)$/);
    if (!beforeMatch) return line;

    const digitsPart = beforeMatch[1];
    let descriptionPart = beforeMatch[2] || '';

    const expectedIndex = runningIndex + 1;
    const expectedStr = String(expectedIndex);

    if (beforePrice.startsWith(expectedStr)) {
      descriptionPart = (digitsPart.slice(expectedStr.length) + descriptionPart).trim();
      runningIndex = expectedIndex;
    } else {
      const candidates: Array<{ index: number; description: string; penalty: number }> = [];
      const maxSplit = Math.min(3, digitsPart.length);
      for (let k = 1; k <= maxSplit; k++) {
        const candidateIndex = Number(digitsPart.slice(0, k));
        if (!candidateIndex) continue;
        const candidateDescription = (digitsPart.slice(k) + descriptionPart).trim();
        if (!candidateDescription) continue;
        const startsWithZero = /^0/.test(candidateDescription);
        const likelyNumericStart = /^\d{1}(?!\d)(?!\s?(?:KG|G|GM|ML|L|LTR|PCS|PACK|PKT|CTN|BAG|BTL|DOZ|X))/i.test(candidateDescription);
        let penalty = startsWithZero ? 50 : 0;
        if (likelyNumericStart) penalty += 10;
        const distance = Math.abs(candidateIndex - expectedIndex);
        penalty += distance * 2;
        candidates.push({ index: candidateIndex, description: candidateDescription, penalty });
      }

      if (candidates.length) {
        candidates.sort((a, b) => a.penalty - b.penalty);
        const best = candidates[0];
        runningIndex = best.index;
        descriptionPart = best.description;
      } else {
        descriptionPart = (digitsPart + descriptionPart).trim();
        runningIndex = expectedIndex;
      }
    }

    if (!descriptionPart) return line;

    return `${descriptionPart},${price},${unit.toUpperCase()}`;
  });

  return csvLines.filter(Boolean).join('\n');
}

const UNIT_TOKEN_REGEX = /(CTN|CTNS|BAG|BAGS|BALE|BUNDL|CASE|PACK|PCS|PC|PKT|PKTS|OUTR|JER|JAR|TIN|CAN|CANS|6PC|3PC|12PC|24PC|DOZ|6PKT|PK|BOX|CARTON)(\d)/gi;

function cleanMahitajiLine(line: string): string {
  let clean = line.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/^([A-Z]{1,4}\d{2,6})([A-Z])/i, '$1 $2');
  clean = clean.replace(UNIT_TOKEN_REGEX, '$1 $2');
  clean = clean.replace(/([0-9])(\*{2,})/g, '$1 $2');
  return clean;
}

function cleanMahitajiPage(page: string): string {
  const lines = page.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => !!line);
  const cleanedLines = lines
    .filter(line => !/^\*+/.test(line))
    .map(cleanMahitajiLine);
  return cleanedLines.join('\n').trim();
}

function preprocessPage(distributorId: string, page: string, pageNumber: number, processedCount: number): string {
  if (distributorId === 'sam-west') {
    return cleanSamWestPage(page, processedCount);
  }
  if (distributorId === 'mahitaji') {
    return cleanMahitajiPage(page);
  }
  return page.trim();
}

function normalizePrice(price: number | string): number {
  if (typeof price === 'number') return price;
  return Number(String(price).replace(/[^0-9.]/g, '')) || 0;
}

function filterValidProducts(rawProducts: RawProduct[]): RawProduct[] {
  return rawProducts.filter(p => {
    if (!p) return false;
    const name = (p.name || '').trim();
    const brand = (p.brand || '').trim();
    const price = normalizePrice(p.price);
    if (!name || name.length < 3) return false;
    if (!brand || brand.length < 2) return false;
    if (price <= 0 || price > 1_000_000) return false;
    if (/^(page|total|subtotal|grand|category|section|product|price|code|name|brand|unit)/i.test(name)) return false;
    if (/^(\d+)$/.test(name)) return false;
    return true;
  });
}

async function fetchImageMap(distributorId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!db) return map;
  try {
    const snapshot = await db.collection('distributor_images').where('distributorId', '==', distributorId).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      const url: string | undefined = data.imageUrl || data.url || data.image || data.imageURL;
      if (!url) return;
      const candidates: string[] = [];
      [data.productName, data.name, data.normalizedName].forEach((value: any) => {
        if (!value) return;
        const base = String(value).toLowerCase().trim();
        if (base && !candidates.includes(base)) candidates.push(base);
        const noApos = base.replace(/[’'`]/g, '');
        if (noApos && !candidates.includes(noApos)) candidates.push(noApos);
      });
      candidates.forEach(key => map.set(key, url));
    });
    log(`🔍 Image map fetched: ${map.size} entries`);
  } catch (error: any) {
    log('⚠️ Image map fetch failed:', error?.message || error);
  }
  return map;
}

function matchImageUrl(name: string, map: Map<string, string>): string | undefined {
  const normalized = name.toLowerCase().trim();
  if (map.has(normalized)) return map.get(normalized);
  const noApos = normalized.replace(/[’'`]/g, '');
  if (map.has(noApos)) return map.get(noApos);
  for (const [key, url] of map.entries()) {
    if (normalized.includes(key) || key.includes(normalized)) return url;
  }
  return undefined;
}

function toProduct(raw: RawProduct, idx: number, distributorName: string, imageMap: Map<string, string>): Product {
  const cleanBrand = titleCasePreserveAcronyms(removeApostrophes((raw.brand || '').trim()));
  const cleanName = normalizeProductName(raw.name || '');
  const unit = normalizeUnit(String(raw.unit || ''));
  const price = normalizePrice(raw.price);
  const description = removeApostrophes((raw.description || '').trim());
  const category = (raw.category || 'general').toLowerCase();
  const image = raw.image || matchImageUrl(cleanName, imageMap);
  const code = buildStableProductCode(String(raw.code || ''), cleanBrand, cleanName, unit);
  return {
    id: idx + 1,
    code,
    name: cleanName,
    description,
    brand: cleanBrand,
    unit,
    price,
    category,
    image,
    inStock: true,
    distributorName,
  };
}

function writeDistributorFile(distributorName: string, products: Product[], outputPath: string) {
  const categories = [...new Set(products.map(p => p.category))].sort();
  const content = `// ${distributorName} Products\n// Auto-generated on ${new Date().toISOString()}\n// Source: TXT pricelist via pagewise OpenAI agent\n\nimport type { Product } from "@/lib/types"\n\nexport const ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products: Product[] = ${JSON.stringify(products, null, 2)};\n\nexport const categories = ${JSON.stringify(categories, null, 2)};\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf-8');
  log(`💾 Updated file: ${outputPath} (${products.length} products)`);
}

function loadExistingProducts(outputPath: string): Product[] {
  if (!fs.existsSync(outputPath)) return [];
  const text = fs.readFileSync(outputPath, 'utf-8');
  const arrayMatch = text.match(/export const .*?_products: Product\[] = (\[[\s\S]*?\]);/);
  if (!arrayMatch) return [];
  try {
    return JSON.parse(arrayMatch[1]) as Product[];
  } catch (error) {
    log('⚠️ Failed to parse existing products file, starting fresh.');
    return [];
  }
}

function buildProductKey(product: { code?: string; brand?: string; name?: string; unit?: string }): string {
  const code = (product.code || '').trim().toUpperCase();
  const brand = (product.brand || '').trim().toUpperCase();
  const name = (product.name || '').trim().toUpperCase();
  const unit = (product.unit || '').trim().toUpperCase();
  return [code, brand, name, unit].join('|');
}

function buildPrompt(distributorName: string, pageNumber: number, totalPages: number, pageText: string, maxItems: number): string {
  return `You are an intelligent product data specialist. Analyze page ${pageNumber} of ${totalPages} from a distributor pricelist and extract clean product listings.\n\nDISTRIBUTOR: ${distributorName}\nPAGE: ${pageNumber} of ${totalPages}\n\nPRICELIST PAGE TEXT (formatted as CSV rows: description, buying_price, unit):\n${pageText}\n\nRules:\n- Each row already strips the numeric index. Description is the first column.\n- Sizes like 10KG, 20PCS etc appear at the beginning of the description column. Capture them accurately without inventing extra digits.\n  Example: "10KG ABABIL PK 386 PARBOILED RICE,KES 1,295.00,BAG" means the product size is 10KG (ten kilograms); keep "10KG" exactly.\n- buying_price column is a string such as "KES 1,295.00"; convert it to a number.\n- Normalize and expand abbreviations; remove apostrophes.\n- brand MUST be the manufacturer.\n- name format: [Brand] [Product Type] [Variant] [Size].\n- description should include packaging/size details.\n- unit must be the selling unit (CTN, BAG, PCS, PKT, BOX, BTL, CAN, DOZ, etc).\n- category must be one of: beverages, food, grains, oils, dairy, personal-care, cleaning, general.\n- Ignore non-product lines (headers/footers/totals).\n\nOutput contract: Return ONLY a JSON object with one key: {"products": [ up to ${maxItems} items with keys exactly: code (string), name (string), description (string), brand (string), unit (string), price (number), category (string) ]}\nNo markdown, no prose.`;
}

async function processPage(pageText: string, pageNumber: number, totalPages: number, imageMap: Map<string, string>, existing: Product[]): Promise<Product[]> {
  const cleanedText = preprocessPage(args.distributorId, pageText, pageNumber, existing.length);
  if (!cleanedText) {
    log(`\n📄 Page ${pageNumber}/${totalPages} is empty after preprocessing, skipping.`);
    return [];
  }
  log(`\n📄 Page ${pageNumber}/${totalPages}: ${pageText.length} chars (clean ${cleanedText.length} chars)`);

  if (args.resume) {
    const cached = loadPageCache(args.distributorId, pageNumber);
    if (cached && cached.length) {
      log(`   🔁 Using cached page ${pageNumber} (${cached.length} items)`);
      const filtered = filterValidProducts(cached);
      const formatted = filtered.map((p, idx) => toProduct(p, existing.length + idx, args.distributorName, imageMap));
      return formatted;
    }
  }

  if (args.dryRun) {
    log('   🧪 Dry run active – skipping OpenAI call, returning empty list.');
    return [];
  }

  const prompt = buildPrompt(args.distributorName, pageNumber, totalPages, cleanedText, args.maxItems);
  log('   🤖 Requesting OpenAI completion...');
  let content = '';
  let finishReason: string | undefined;
  let totalTokens: number | undefined;
  let lastError: any = null;
  for (let attempt = 1; attempt <= args.retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert retail catalog merchandiser. Output ONLY JSON. No prose. Return an array of objects with code,name,description,brand,unit,price,category.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: args.temperature,
        max_tokens: args.maxTokens,
        response_format: { type: 'json_object' },
      } as any);
      const choice = response.choices?.[0];
      content = choice?.message?.content || '';
      finishReason = choice?.finish_reason;
      totalTokens = (response as any)?.usage?.total_tokens ?? undefined;
      if (!content) throw new Error('Empty content from model');
      // Save raw for debugging
      saveRawResponse(args.distributorId, pageNumber, content);
      break;
    } catch (err: any) {
      lastError = err;
      const waitMs = Math.min(1000 * attempt, 5000);
      log(`   ⚠️ OpenAI call failed (attempt ${attempt}/${args.retries}):`, err?.message || String(err));
      if (attempt < args.retries) {
        await new Promise(res => setTimeout(res, waitMs));
        continue;
      }
    }
  }
  if (!content) {
    log('   ❌ No content from model after retries; skipping page.');
    return [];
  }

  if (finishReason) {
    const tokenInfo = typeof totalTokens === 'number' ? ` (~${totalTokens} tokens)` : '';
    log(`   🧾 Finish reason: ${finishReason}${tokenInfo}`);
    if (finishReason === 'length') {
      log('   ⚠️ Model output was truncated. Consider lowering --max-items or increasing --max-tokens. Using fallback parser.');
    }
  }

  let parseResult = safeParseArray(content);
  let raw = parseResult.items;
  if (!raw.length && parseResult.error) {
    const recovered = recoverProductsFromPartialJson(content);
    if (recovered.length) {
      log(`   ⚠️ Fallback parser recovered ${recovered.length} items from partial JSON.`);
      raw = recovered;
    }
  }
  log(`   ✅ Model returned ${raw.length} raw entries`);
  const filtered = filterValidProducts(raw);
  log(`   ✅ ${filtered.length} entries passed validation`);
  savePageCache(args.distributorId, pageNumber, filtered);
  const formatted = filtered.map((item, idx) => toProduct(item, existing.length + idx, args.distributorName, imageMap));
  return formatted;
}

async function main() {
  const rawText = await loadPricelistText(args.txtPath);
  const pages = splitIntoPages(rawText);
  log(`📚 Found ${pages.length} pages in source document`);

  const start = args.startPage ? Math.max(1, args.startPage) : 1;
  const end = args.endPage ? Math.min(args.endPage, pages.length) : pages.length;
  const imageMap = await fetchImageMap(args.distributorId);

  let products = loadExistingProducts(args.outputPath);
  if (products.length) {
    log(`📦 Loaded ${products.length} existing products from output file`);
  }

  products = products.map((p, idx) => ({ ...p, id: idx + 1 }));
  const seenKeys = new Map<string, Product>();
  for (const product of products) {
    seenKeys.set(buildProductKey(product), product);
  }
  let nextId = products.length;

  let processed = 0;
  for (let pageIndex = start - 1; pageIndex < end; pageIndex++) {
    const pageNumber = pageIndex + 1;
    if (args.maxPages && processed >= args.maxPages) {
      log(`🛑 Reached --max-pages (${args.maxPages}). Stopping early.`);
      break;
    }

    const pageText = pages[pageIndex];
    if (!pageText || !pageText.trim()) {
      log(`   ⚠️ Page ${pageNumber} is empty, skipping.`);
      continue;
    }

    const newProducts = await processPage(pageText, pageNumber, pages.length, imageMap, products);
    if (newProducts.length) {
      let added = 0;
      for (const candidate of newProducts) {
        const key = buildProductKey(candidate);
        if (seenKeys.has(key)) {
          continue;
        }
        const product: Product = { ...candidate, id: ++nextId };
        seenKeys.set(key, product);
        products.push(product);
        added++;
      }
      if (added) {
      writeDistributorFile(args.distributorName, products, args.outputPath);
      } else {
        log(`   ℹ️ Page ${pageNumber} produced only duplicates, skipping write.`);
      }
    }

    processed++;
  }

  log('\n✅ Pagewise extraction complete.');
  log(`   Total products: ${products.length}`);
  if (products.length) {
    const priceValues = products.map(p => Number(p.price) || 0);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    log(`   Price range   : ${minPrice} - ${maxPrice}`);
    log(`   Categories    : ${new Set(products.map(p => p.category)).size}`);
  }
}

main().catch(error => {
  log('💥 Fatal error:', error?.message || error);
  process.exit(1);
});
