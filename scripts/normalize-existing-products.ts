/**
 * Normalize existing distributor product files using the same rules as the extractor
 * - Spell out abbreviations
 * - Remove apostrophes from names
 * - Title Case names (preserving acronyms)
 * - Ensure brand is not a size/quantity; infer from name if needed
 * - Normalize unit to a standard set
 * - Keep a single numeric price field
 */

import * as fs from 'fs';
import * as path from 'path';

type AnyRecord = Record<string, any>;

// Normalization helpers (copied from extractor)
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
  const mapped = (ABBREV_MAP as AnyRecord)[clean] || unit;
  return titleCasePreserveAcronyms(mapped);
}

function inferBrandFromName(name: string): string | null {
  const tokens = (name || '').trim().split(/\s+/);
  if (tokens.length === 0) return null;
  // Take first token that contains letters
  const candidate = tokens.find(t => /[a-zA-Z]/.test(t)) || tokens[0];
  return titleCasePreserveAcronyms(removeApostrophes(candidate));
}

// Build uniform name: "Brand Core Variant Size"
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
    unit = (ABBREV_MAP as AnyRecord)[unit] ? (ABBREV_MAP as AnyRecord)[unit] : unit;
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

const invalidBrandRe = /^(\d+\s*(kg|g|ml|l|ltr|litre|pcs|ctn|x\d+))/i;

function normalizeProduct(p: AnyRecord): AnyRecord {
  const originalName = p.name || '';
  const originalBrand = p.brand || '';
  const desc = p.description || '';

  // Brand: clean; if invalid, infer from name
  let brand = titleCasePreserveAcronyms(removeApostrophes(String(originalBrand)));
  if (invalidBrandRe.test(brand) || brand.length === 0) {
    const inferred = inferBrandFromName(String(originalName));
    if (inferred) brand = inferred;
  }

  // Name: normalized with brand + size
  const name = normalizeProductName(String(originalName), brand, String(desc));

  // Unit
  const unit = normalizeUnit(String(p.unit || ''));

  // Price: single numeric
  const price = Number(String(p.price ?? p.unitPrice ?? p.wholesalePrice ?? 0).replace(/[^0-9.]/g, ''));

  // Category: lower-case, fallback to general
  const category = String(p.category || 'general').toLowerCase();

  // Description: remove apostrophes
  const description = removeApostrophes(String(desc)).trim();

  return {
    ...p,
    name,
    brand,
    unit,
    price,
    category,
    description,
    inStock: p.inStock === undefined ? true : !!p.inStock
  };
}

function extractArrayFromFile(content: string, varName: string): { start: number; end: number; json: string } | null {
  const pattern = new RegExp(`export\\s+const\\s+${varName}\\s*:\\s*Product\\\\[\\\\]\\s*=\\s*`);
  const match = content.match(pattern);
  if (!match) return null;
  const startIdx = (match.index || 0) + match[0].length;
  // Find array starting '['
  let i = startIdx;
  while (i < content.length && content[i] !== '[') i++;
  if (i >= content.length) return null;
  const arrStart = i;
  // Bracket match to find closing ']'
  let depth = 0;
  let inStr: string | null = null;
  for (; i < content.length; i++) {
    const ch = content[i];
    const prev = content[i - 1];
    if (inStr) {
      if (ch === inStr && prev !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === '\'') { inStr = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  const arrEnd = i; // points after ']'
  const json = content.slice(arrStart, arrEnd);
  return { start: arrStart, end: arrEnd, json };
}

function updateProductsInFile(filePath: string) {
  const fileName = path.basename(filePath);
  const distributorVar = fileName.replace(/-products\.ts$/, '').replace(/-/g, '_'); // e.g., sam-west -> sam_west
  const varName = `${distributorVar}_products`;
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found, skipping: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const extracted = extractArrayFromFile(content, varName);
  if (!extracted) {
    console.warn(`⚠️  Could not locate products array in ${filePath} (var: ${varName})`);
    return;
  }
  let products: AnyRecord[] = [];
  try {
    products = JSON.parse(extracted.json);
  } catch (e) {
    console.error(`❌ Failed to parse products JSON in ${filePath}:`, (e as any)?.message || e);
    return;
  }

  let changed = 0;
  const normalized = products.map((p) => {
    const before = JSON.stringify({ name: p.name, brand: p.brand, unit: p.unit, price: p.price });
    const np = normalizeProduct(p);
    const after = JSON.stringify({ name: np.name, brand: np.brand, unit: np.unit, price: np.price });
    if (before !== after) changed++;
    return np;
  });

  const newJson = JSON.stringify(normalized, null, 2);
  const newContent = content.slice(0, extracted.start) + newJson + content.slice(extracted.end);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`✅ Updated ${filePath} — ${changed} product(s) normalized (total ${normalized.length})`);
}

function main() {
  const root = process.cwd();
  const dir = path.join(root, 'data', 'distributors');
  const targets = [
    path.join(dir, 'sam-west-products.ts'),
    path.join(dir, 'mahitaji-products.ts')
  ];
  targets.forEach(updateProductsInFile);
  console.log('✨ Normalization complete');
}

main();
