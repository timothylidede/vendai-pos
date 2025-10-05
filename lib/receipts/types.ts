import type { POSReceipt, POSReceiptPaymentLine } from '@/types/pos'
import type { POSOrderDoc, POSOrderLine } from '@/lib/types'

export const RECEIPT_BUILDER_VERSION = '2025.10.05-1'

export type CurrencyCode = string

export interface ReceiptOrgInfo {
  id: string
  name: string
  legalName?: string
  addressLines?: string[]
  contactEmail?: string
  contactPhone?: string
  taxRegistration?: string
  websiteUrl?: string
  logoUrl?: string
  footerNote?: string
  currency?: CurrencyCode
}

export interface ReceiptExtraField {
  label: string
  value: string
}

export interface ReceiptTemplateConfig {
  headerLines?: string[]
  footerLines?: string[]
  showLogo?: boolean
  accentColor?: string
  includeBarcode?: boolean
  barcodeValue?: string
  includeQr?: boolean
  qrValue?: string
}

export interface ReceiptTotals {
  subtotal: number
  taxTotal: number
  discountTotal: number
  grandTotal: number
  changeDue: number
}

export interface ReceiptItem {
  id?: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  sku?: string
  category?: string
  metadata?: Record<string, unknown>
}

export interface ReceiptBuilderInput {
  order: POSOrderDoc
  lines?: POSOrderLine[]
}

export interface ReceiptBuilderOptions {
  org: ReceiptOrgInfo
  cashierName?: string
  registerId?: string
  issuedBy?: string
  issuedAt?: string
  template?: ReceiptTemplateConfig
  notes?: string
  extraFields?: ReceiptExtraField[]
  totalsOverride?: Partial<Omit<ReceiptTotals, 'grandTotal'>> & { grandTotal?: number }
  changeDueOverride?: number
  documentUrls?: POSReceipt['documentUrls']
  metadata?: Record<string, unknown>
}

export interface ReceiptHeaderPresentation {
  orgName: string
  legalName?: string
  headerLines: string[]
  logoUrl?: string
  templateAccent?: string
  extraFields: ReceiptExtraField[]
}

export interface ReceiptFooterPresentation {
  footerLines: string[]
  notes?: string
}

export interface ReceiptBuilderResult {
  receipt: POSReceipt
  items: ReceiptItem[]
  totals: ReceiptTotals
  payments: POSReceiptPaymentLine[]
  header: ReceiptHeaderPresentation
  footer: ReceiptFooterPresentation
  cashierName?: string
  registerId?: string
  changeDue?: number
  org: ReceiptOrgInfo
  builderMeta: {
    version: string
    generatedAt: string
  }
}

export interface ReceiptArtifacts {
  html?: string
  pdfBytes?: Uint8Array
  escposBase64?: string
  documentUrls?: POSReceipt['documentUrls']
  storagePaths?: {
    html?: string
    pdf?: string
  }
  metadata?: Record<string, unknown>
}

export interface ReceiptPreviewBundle {
  result: ReceiptBuilderResult
  artifacts?: ReceiptArtifacts
}
