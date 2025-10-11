/**
 * CSV/XLSX Parser with Auto-Detection
 * Handles common POS/ERP export formats with fuzzy column mapping
 */

import * as XLSX from 'xlsx';

export interface ParsedColumn {
  originalName: string;
  mappedField: string | null;
  confidence: number; // 0-1
  suggestions: string[];
  sampleData: string[];
}

export interface ParsedRow {
  [key: string]: any;
}

export interface ParseResult {
  columns: ParsedColumn[];
  rows: ParsedRow[];
  totalRows: number;
  fileName: string;
  fileType: 'csv' | 'xlsx';
}

// Standard field mappings
const FIELD_MAPPINGS: Record<string, string[]> = {
  name: ['name', 'product', 'product name', 'item', 'item name', 'description', 'title', 'product_name'],
  barcode: ['barcode', 'ean', 'upc', 'sku', 'product_code', 'item_code', 'code', 'barcode_number'],
  retailPrice: ['price', 'retail price', 'selling price', 'sale price', 'unit price', 'retail_price', 'cost'],
  category: ['category', 'type', 'department', 'group', 'product_category'],
  qtyBase: ['stock', 'quantity', 'qty', 'inventory', 'stock_level', 'on_hand', 'available'],
  costPrice: ['cost', 'cost price', 'purchase price', 'wholesale', 'cost_price', 'buy_price'],
  taxRate: ['tax', 'vat', 'tax rate', 'vat_rate', 'tax_percent'],
  unitsPerBase: ['units', 'pack size', 'case qty', 'units_per_case', 'pack_qty'],
  brand: ['brand', 'manufacturer', 'supplier', 'vendor'],
  unit: ['unit', 'uom', 'unit of measure', 'measure'],
};

/**
 * Fuzzy match column name to standard field
 */
function fuzzyMatch(columnName: string, targetWords: string[]): number {
  const normalized = columnName.toLowerCase().trim();
  
  // Exact match
  if (targetWords.includes(normalized)) return 1.0;
  
  // Partial match
  let maxScore = 0;
  for (const target of targetWords) {
    const targetNorm = target.toLowerCase();
    
    // Contains target
    if (normalized.includes(targetNorm)) {
      maxScore = Math.max(maxScore, 0.8);
    }
    
    // Target contains column
    if (targetNorm.includes(normalized)) {
      maxScore = Math.max(maxScore, 0.7);
    }
    
    // Levenshtein distance (simple version)
    const distance = levenshteinDistance(normalized, targetNorm);
    const maxLen = Math.max(normalized.length, targetNorm.length);
    const similarity = 1 - distance / maxLen;
    
    if (similarity > 0.6) {
      maxScore = Math.max(maxScore, similarity * 0.9);
    }
  }
  
  return maxScore;
}

/**
 * Simple Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Auto-detect column mappings
 */
function autoDetectColumns(headers: string[]): ParsedColumn[] {
  const columns: ParsedColumn[] = [];
  
  for (const header of headers) {
    let bestMatch: string | null = null;
    let bestScore = 0;
    const suggestions: Array<{ field: string; score: number }> = [];
    
    // Try to match against each standard field
    for (const [field, patterns] of Object.entries(FIELD_MAPPINGS)) {
      const score = fuzzyMatch(header, patterns);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = field;
      }
      
      if (score > 0.5) {
        suggestions.push({ field, score });
      }
    }
    
    // Sort suggestions by score
    suggestions.sort((a, b) => b.score - a.score);
    
    columns.push({
      originalName: header,
      mappedField: bestScore > 0.6 ? bestMatch : null,
      confidence: bestScore,
      suggestions: suggestions.slice(0, 3).map(s => s.field),
      sampleData: [],
    });
  }
  
  return columns;
}

/**
 * Parse CSV file
 */
export async function parseCSV(file: File): Promise<ParseResult> {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const columns = autoDetectColumns(headers);
  
  // Parse rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: ParsedRow = { _rowIndex: i };
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  // Add sample data to columns
  columns.forEach((col, index) => {
    col.sampleData = rows.slice(0, 5).map(row => row[col.originalName] || '');
  });
  
  return {
    columns,
    rows,
    totalRows: rows.length,
    fileName: file.name,
    fileType: 'csv',
  };
}

/**
 * Parse XLSX file
 */
export async function parseXLSX(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  if (jsonData.length === 0) {
    throw new Error('XLSX file is empty');
  }
  
  // Parse headers
  const headers = (jsonData[0] as any[]).map(h => String(h).trim());
  const columns = autoDetectColumns(headers);
  
  // Parse rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const values = jsonData[i] as any[];
    const row: ParsedRow = { _rowIndex: i };
    
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? String(values[index]) : '';
    });
    
    rows.push(row);
  }
  
  // Add sample data to columns
  columns.forEach((col, index) => {
    col.sampleData = rows.slice(0, 5).map(row => row[col.originalName] || '');
  });
  
  return {
    columns,
    rows,
    totalRows: rows.length,
    fileName: file.name,
    fileType: 'xlsx',
  };
}

/**
 * Parse file (auto-detect type)
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'csv') {
    return parseCSV(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSX(file);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Transform parsed rows to product format
 */
export function transformToProducts(
  rows: ParsedRow[],
  columnMapping: Record<string, string>
): Partial<any>[] {
  return rows.map(row => {
    const product: any = {};
    
    for (const [originalCol, mappedField] of Object.entries(columnMapping)) {
      const value = row[originalCol];
      
      if (value !== undefined && value !== '') {
        // Type conversions
        if (['retailPrice', 'costPrice', 'taxRate', 'qtyBase', 'unitsPerBase'].includes(mappedField)) {
          product[mappedField] = parseFloat(value) || 0;
        } else {
          product[mappedField] = value;
        }
      }
    }
    
    return product;
  });
}
