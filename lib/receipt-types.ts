/**
 * Receipt Printing Types and Utilities
 * Support for ESC/POS thermal printers and HTML receipts
 */

export interface PrinterConfig {
  type: 'thermal' | 'browser'
  model?: 'epson-tm-t88' | 'star-tsp100' | 'other'
  ip?: string
  port?: number
  paperWidth?: 58 | 80 // mm
  characterWidth?: number // characters per line
  enableLogo?: boolean
  logoPath?: string
  footer?: string
}

export interface OrgPrinterSettings {
  orgId: string
  printers: {
    [key: string]: PrinterConfig // key = printer ID or lane ID
  }
  defaultPrinterId?: string
  autoPrint?: boolean
}

export interface FormattedReceipt {
  html: string
  escpos?: Buffer // ESC/POS commands for thermal printer
  plainText: string
}

export interface ReceiptData {
  receiptNumber: string
  orderId: string
  orgName: string
  orgAddress?: string
  orgPhone?: string
  orgTax?: string // Tax ID / VAT number
  issuedAt: string
  cashierName?: string
  laneId?: string
  items: ReceiptItem[]
  subtotal: number
  tax?: number
  discount?: number
  total: number
  payments: ReceiptPayment[]
  changeDue?: number
  footer?: string
}

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
  tax?: number
}

export interface ReceiptPayment {
  method: string
  amount: number
}
