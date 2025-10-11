/**
 * Barcode Scale Support Utilities
 * Parse weight-based barcodes (EAN-13 with embedded price/weight)
 */

export interface BarcodeParseResult {
  productCode: string
  isWeightEmbedded: boolean
  weight?: number // in kg
  price?: number // calculated price
  rawBarcode: string
}

export interface WeightBarcodeConfig {
  format: 'ean13-price' | 'ean13-weight' | 'custom'
  productCodeStart: number
  productCodeLength: number
  valueStart: number // position where price/weight encoding starts
  valueLength: number
  valueType: 'price' | 'weight'
  divisor: number // e.g., 100 for cents, 1000 for grams
  prefix?: string // barcode prefix filter (e.g., '02' for weight items)
}

export interface OrgBarcodeSettings {
  orgId: string
  weightBarcodeConfig?: WeightBarcodeConfig
  enableWeightBarcodes: boolean
}

/**
 * Parse EAN-13 barcode with embedded weight or price
 * 
 * Common format:
 * - Digit 1-2: Product category (02, 20-29 typically for weight items)
 * - Digit 3-7: Product code (5 digits)
 * - Digit 8-12: Price in cents OR weight in grams (5 digits)
 * - Digit 13: Check digit
 * 
 * Example: 2012345067890
 * - 20: Weight item prefix
 * - 12345: Product code
 * - 06789: Weight = 678.9g (67890 / 100)
 * - 0: Check digit
 */
export function parseWeightBarcode(
  barcode: string,
  config: WeightBarcodeConfig
): BarcodeParseResult {
  // Validate barcode length
  if (barcode.length !== 13) {
    return {
      productCode: barcode,
      isWeightEmbedded: false,
      rawBarcode: barcode,
    }
  }

  // Check prefix if configured
  if (config.prefix && !barcode.startsWith(config.prefix)) {
    return {
      productCode: barcode,
      isWeightEmbedded: false,
      rawBarcode: barcode,
    }
  }

  try {
    // Extract product code
    const productCode = barcode.substring(
      config.productCodeStart,
      config.productCodeStart + config.productCodeLength
    )

    // Extract encoded value (price or weight)
    const valueString = barcode.substring(
      config.valueStart,
      config.valueStart + config.valueLength
    )
    const encodedValue = parseInt(valueString, 10)

    if (isNaN(encodedValue)) {
      return {
        productCode: barcode,
        isWeightEmbedded: false,
        rawBarcode: barcode,
      }
    }

    const actualValue = encodedValue / config.divisor

    if (config.valueType === 'weight') {
      return {
        productCode,
        isWeightEmbedded: true,
        weight: actualValue,
        rawBarcode: barcode,
      }
    } else {
      return {
        productCode,
        isWeightEmbedded: true,
        price: actualValue,
        rawBarcode: barcode,
      }
    }
  } catch (error) {
    console.error('Error parsing weight barcode:', error)
    return {
      productCode: barcode,
      isWeightEmbedded: false,
      rawBarcode: barcode,
    }
  }
}

/**
 * Calculate price for weight-based product
 */
export function calculateWeightPrice(
  weightKg: number,
  pricePerKg: number
): number {
  return Math.round(weightKg * pricePerKg * 100) / 100 // Round to 2 decimals
}

/**
 * Default weight barcode configuration for common formats
 */
export const DEFAULT_WEIGHT_BARCODE_CONFIGS: Record<string, WeightBarcodeConfig> = {
  'ean13-weight-standard': {
    format: 'ean13-weight',
    productCodeStart: 2,
    productCodeLength: 5,
    valueStart: 7,
    valueLength: 5,
    valueType: 'weight',
    divisor: 1000, // grams to kg
    prefix: '2',
  },
  'ean13-price-standard': {
    format: 'ean13-price',
    productCodeStart: 2,
    productCodeLength: 5,
    valueStart: 7,
    valueLength: 5,
    valueType: 'price',
    divisor: 100, // cents to currency
    prefix: '2',
  },
}

/**
 * Generate weight-embedded barcode
 * Useful for testing and label printing
 */
export function generateWeightBarcode(
  productCode: string,
  weightGrams: number,
  config: WeightBarcodeConfig
): string {
  // Pad product code
  const paddedCode = productCode.padStart(config.productCodeLength, '0')
  
  // Encode weight/price
  const encodedValue = Math.round(weightGrams * (config.divisor / 1000))
  const paddedValue = encodedValue.toString().padStart(config.valueLength, '0')
  
  // Build barcode without check digit
  const prefix = config.prefix || '2'
  const barcodeWithoutCheck = prefix + paddedCode + paddedValue
  
  // Calculate EAN-13 check digit
  let sum = 0
  for (let i = 0; i < barcodeWithoutCheck.length; i++) {
    const digit = parseInt(barcodeWithoutCheck[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const checkDigit = (10 - (sum % 10)) % 10
  
  return barcodeWithoutCheck + checkDigit
}

/**
 * Validate EAN-13 check digit
 */
export function validateEAN13CheckDigit(barcode: string): boolean {
  if (barcode.length !== 13) return false
  
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i], 10)
    if (isNaN(digit)) return false
    sum += i % 2 === 0 ? digit : digit * 3
  }
  
  const calculatedCheck = (10 - (sum % 10)) % 10
  const providedCheck = parseInt(barcode[12], 10)
  
  return calculatedCheck === providedCheck
}
