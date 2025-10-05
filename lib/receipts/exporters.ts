import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { ReceiptBuilderResult } from './types'

export interface RenderReceiptHtmlOptions {
  accentColor?: string
  includeStyles?: boolean
}

export interface RenderReceiptPdfOptions {
  scale?: number
  fileName?: string
  paperWidthPx?: number
}

const PX_TO_MM = 0.2645833333 // assuming 96 DPI

export const renderReceiptToHtml = (
  result: ReceiptBuilderResult,
  options: RenderReceiptHtmlOptions = {},
): string => {
  const accent = options.accentColor ?? result.header.templateAccent ?? '#1f2937'
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: result.org.currency ?? 'KES',
  })

  const itemsRows = result.items
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td class="qty">${item.quantity}</td>
          <td class="amount">${currencyFormatter.format(item.lineTotal)}</td>
        </tr>
      `,
    )
    .join('\n')

  const paymentsRows = result.payments
    .map(
      (payment) => `
        <li><span>${payment.method.replace(/_/g, ' ')}</span><span>${currencyFormatter.format(
        payment.amount,
      )}</span></li>
      `,
    )
    .join('\n')

  const headerLines = result.header.headerLines
    .map((line) => `<div class="subline">${line}</div>`)
    .join('\n')

  const footerLines = result.footer.footerLines
    .map((line) => `<div class="footer-line">${line}</div>`)
    .join('\n')

  const css = options.includeStyles !== false
    ? `
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #111827; }
        .receipt { width: 280px; margin: 0 auto; padding: 16px; background: #fff; }
        .header { text-align: center; margin-bottom: 16px; }
        .header .title { font-weight: 700; font-size: 18px; color: ${accent}; }
        .header .subline { font-size: 12px; color: #4b5563; }
        .meta { font-size: 12px; margin-bottom: 16px; }
        .meta div { display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; border-bottom: 1px dashed #d1d5db; padding-bottom: 4px; }
        td { padding: 4px 0; }
        td.amount { text-align: right; }
        td.qty { text-align: center; width: 48px; }
        .totals { margin-top: 12px; font-size: 12px; }
        .totals li { display: flex; justify-content: space-between; padding: 2px 0; }
        .payments { list-style: none; padding: 0; margin: 12px 0 0 0; font-size: 12px; }
        .payments li { display: flex; justify-content: space-between; }
        .footer { margin-top: 16px; font-size: 11px; text-align: center; color: #6b7280; }
        .notes { margin-top: 8px; font-style: italic; }
      </style>
    `
    : ''

  const totals = result.totals
  const totalsMarkup = `
    <ul class="totals">
      <li><span>Subtotal</span><span>${currencyFormatter.format(totals.subtotal)}</span></li>
      ${totals.taxTotal > 0 ? `<li><span>Tax</span><span>${currencyFormatter.format(totals.taxTotal)}</span></li>` : ''}
      ${totals.discountTotal > 0 ? `<li><span>Discounts</span><span>-${currencyFormatter.format(
        totals.discountTotal,
      )}</span></li>` : ''}
      <li><strong>Total</strong><strong>${currencyFormatter.format(totals.grandTotal)}</strong></li>
      ${totals.changeDue > 0 ? `<li><span>Change due</span><span>${currencyFormatter.format(
        totals.changeDue,
      )}</span></li>` : ''}
    </ul>
  `

  const paymentsMarkup = result.payments.length
    ? `<ul class="payments">${paymentsRows}</ul>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        ${css}
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="title">${result.header.orgName}</div>
            ${headerLines}
          </div>
          <div class="meta">
            <div><span>Receipt #</span><span>${result.receipt.receiptNumber}</span></div>
            <div><span>Date</span><span>${result.receipt.issuedAt}</span></div>
            ${result.cashierName ? `<div><span>Cashier</span><span>${result.cashierName}</span></div>` : ''}
            ${result.registerId ? `<div><span>Register</span><span>${result.registerId}</span></div>` : ''}
            ${result.receipt.customer?.name ? `<div><span>Customer</span><span>${result.receipt.customer.name}</span></div>` : ''}
          </div>
          <table>
            <thead>
              <tr><th>Item</th><th class="qty">Qty</th><th class="amount">Amount</th></tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          ${totalsMarkup}
          ${paymentsMarkup}
          <div class="footer">
            ${footerLines}
            ${result.footer.notes ? `<div class="notes">${result.footer.notes}</div>` : ''}
          </div>
        </div>
      </body>
    </html>
  `
}

export const renderReceiptToPdfBytes = async (
  result: ReceiptBuilderResult,
  options: RenderReceiptPdfOptions = {},
): Promise<Uint8Array> => {
  if (typeof window === 'undefined') {
    throw new Error('Receipt PDF export requires a browser environment.')
  }

  const html = renderReceiptToHtml(result)
  const container = document.createElement('div')
  const scale = options.scale ?? 2
  container.innerHTML = html
  container.style.position = 'fixed'
  container.style.pointerEvents = 'none'
  container.style.opacity = '0'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = `${options.paperWidthPx ?? 280}px`
  document.body.appendChild(container)

  try {
    const receiptRoot = container.querySelector('.receipt') as HTMLElement | null
    if (!receiptRoot) {
      throw new Error('Failed to render receipt markup for PDF export.')
    }

    const canvas = await html2canvas(receiptRoot, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
    })

    const widthMm = (canvas.width / scale) * PX_TO_MM
    const heightMm = (canvas.height / scale) * PX_TO_MM
    const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] })
    const imageData = canvas.toDataURL('image/png', 1.0)
    pdf.addImage(imageData, 'PNG', 0, 0, widthMm, heightMm)

    const arrayBuffer = pdf.output('arraybuffer')
    return new Uint8Array(arrayBuffer)
  } finally {
    document.body.removeChild(container)
  }
}

export const htmlStringToUint8Array = (html: string): Uint8Array => new TextEncoder().encode(html)

export const downloadPdf = (pdfBytes: Uint8Array, fileName = 'receipt.pdf') => {
  if (typeof window === 'undefined') return
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
