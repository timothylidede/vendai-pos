import { formatISO } from 'date-fns'
import type { POSOrderDoc, POSOrderLine } from '@/lib/types'
import type { POSReceiptPaymentLine } from '@/types/pos'
import {
  RECEIPT_BUILDER_VERSION,
  type ReceiptBuilderInput,
  type ReceiptBuilderOptions,
  type ReceiptBuilderResult,
  type ReceiptFooterPresentation,
  type ReceiptHeaderPresentation,
  type ReceiptItem,
  type ReceiptTotals,
} from './types'

const toCurrency = (amount: number) => Number(amount.toFixed(2))

const resolveItems = (lines: POSOrderLine[]): ReceiptItem[] =>
  lines.map((line) => ({
    id: line.productId,
    name: line.name,
    quantity: line.quantityPieces,
    unitPrice: toCurrency(line.unitPrice),
    lineTotal: toCurrency(line.lineTotal),
  }))

const computeTotals = (
  items: ReceiptItem[],
  order: POSOrderDoc,
  options: ReceiptBuilderOptions,
): ReceiptTotals => {
  const subtotalFromLines = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const subtotal = toCurrency(options.totalsOverride?.subtotal ?? subtotalFromLines)
  const taxTotal = toCurrency(options.totalsOverride?.taxTotal ?? (order.checkoutContext?.taxTotal ?? 0))
  const discountTotal = toCurrency(options.totalsOverride?.discountTotal ?? (order.checkoutContext?.discountTotal ?? 0))
  const grandTotal = toCurrency(
    options.totalsOverride?.grandTotal ?? (order.total ?? subtotal + taxTotal - discountTotal),
  )
  const changeDue = toCurrency(
    options.changeDueOverride ??
      options.totalsOverride?.changeDue ??
      order.paymentSummary?.totalChange ??
      order.checkoutContext?.changeDue ??
      0,
  )
  return {
    subtotal,
    taxTotal,
    discountTotal,
    grandTotal,
    changeDue,
  }
}

const mapPayments = (order: POSOrderDoc): POSReceiptPaymentLine[] =>
  (order.payments ?? []).map((payment) => ({
    method: payment.method,
    amount: toCurrency(payment.amount),
  }))

const buildHeader = (options: ReceiptBuilderOptions): ReceiptHeaderPresentation => {
  const { org } = options
  const generatedHeaderLines: string[] = []

  if (org.legalName && org.legalName !== org.name) {
    generatedHeaderLines.push(org.legalName)
  }

  if (org.addressLines?.length) {
    generatedHeaderLines.push(...org.addressLines)
  }

  if (org.contactPhone) {
    generatedHeaderLines.push(`Tel: ${org.contactPhone}`)
  }

  if (org.contactEmail) {
    generatedHeaderLines.push(org.contactEmail)
  }

  if (org.websiteUrl) {
    generatedHeaderLines.push(org.websiteUrl)
  }

  if (org.taxRegistration) {
    generatedHeaderLines.push(`Tax ID: ${org.taxRegistration}`)
  }

  const headerLines = options.template?.headerLines ?? generatedHeaderLines

  return {
    orgName: org.name,
    legalName: org.legalName,
    headerLines,
    logoUrl: options.template?.showLogo === false ? undefined : org.logoUrl,
    templateAccent: options.template?.accentColor,
    extraFields: options.extraFields ?? [],
  }
}

const buildFooter = (options: ReceiptBuilderOptions): ReceiptFooterPresentation => {
  const fallbackLines: string[] = []
  if (options.org.footerNote) {
    fallbackLines.push(options.org.footerNote)
  }
  fallbackLines.push('Thank you for shopping with us!')
  if (options.template?.includeBarcode && options.template.barcodeValue) {
    fallbackLines.push(`Barcode: ${options.template.barcodeValue}`)
  }
  if (options.template?.includeQr && options.template.qrValue) {
    fallbackLines.push(`QR: ${options.template.qrValue}`)
  }

  return {
    footerLines: options.template?.footerLines ?? fallbackLines,
    notes: options.notes,
  }
}

export const buildReceipt = (
  input: ReceiptBuilderInput,
  options: ReceiptBuilderOptions,
): ReceiptBuilderResult => {
  const order = input.order
  const lines = input.lines ?? order.lines ?? []
  const items = resolveItems(lines)
  const totals = computeTotals(items, order, options)
  const payments = mapPayments(order)

  const receiptNumber = order.receiptNumber ?? `POS-${order.id ?? Date.now()}`
  const issuedAt = options.issuedAt ?? order.completedAt ?? order.updatedAt ?? formatISO(new Date())
  const issuedBy = String(
    options.issuedBy ??
    options.cashierName ??
    order.checkoutContext?.metadata?.cashierName ??
    order.cashierId ??
    order.userId ??
    'system'
  )

  const receipt = {
    receiptNumber,
    orderId: order.id ?? receiptNumber,
    orgId: options.org.id,
    issuedAt,
    issuedBy,
    registerId: options.registerId ?? order.checkoutContext?.registerId,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal || undefined,
    discountTotal: totals.discountTotal || undefined,
    grandTotal: totals.grandTotal,
    payments,
    customer: order.checkoutContext?.customer,
    documentUrls: options.documentUrls,
    metadata: {
      ...options.metadata,
      builderVersion: RECEIPT_BUILDER_VERSION,
      orderStatus: order.status,
      changeDue: totals.changeDue,
      cashierId: order.cashierId,
      registerId: options.registerId ?? order.checkoutContext?.registerId,
    },
  }

  const header = buildHeader(options)
  const footer = buildFooter(options)

  return {
    receipt,
    items,
    totals,
    payments,
    header,
    footer,
    cashierName: options.cashierName,
    registerId: receipt.registerId,
    changeDue: totals.changeDue,
    org: options.org,
    builderMeta: {
      version: RECEIPT_BUILDER_VERSION,
      generatedAt: formatISO(new Date()),
    },
  }
}

export type { ReceiptArtifacts } from './types'
