/**
 * Receipt Formatter
 * Generate HTML and ESC/POS formatted receipts
 */

import type { FormattedReceipt, ReceiptData, PrinterConfig } from './receipt-types'

/**
 * Format receipt as HTML for browser printing
 */
export function formatReceiptHTML(data: ReceiptData): string {
  const dateFormatted = new Date(data.issuedAt).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${data.receiptNumber}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      max-width: 80mm;
      margin: 0 auto;
      padding: 10mm;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .item-row td { padding: 2px 0; }
    .item-name { max-width: 50%; }
    .right { text-align: right; }
    .total-row { font-weight: bold; border-top: 2px solid #000; padding-top: 4px; }
    .footer { margin-top: 16px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="center bold">
    <div style="font-size: 16px;">${data.orgName}</div>
    ${data.orgAddress ? `<div>${data.orgAddress}</div>` : ''}
    ${data.orgPhone ? `<div>Tel: ${data.orgPhone}</div>` : ''}
    ${data.orgTax ? `<div>Tax ID: ${data.orgTax}</div>` : ''}
  </div>
  
  <div class="divider"></div>
  
  <div>
    <div>Receipt: ${data.receiptNumber}</div>
    <div>Date: ${dateFormatted}</div>
    ${data.cashierName ? `<div>Cashier: ${data.cashierName}</div>` : ''}
    ${data.laneId ? `<div>Lane: ${data.laneId}</div>` : ''}
  </div>
  
  <div class="divider"></div>
  
  <table>
    ${data.items.map(item => `
      <tr class="item-row">
        <td class="item-name">${item.name}</td>
        <td class="right">${item.quantity} x ₹${item.unitPrice.toFixed(2)}</td>
      </tr>
      <tr class="item-row">
        <td></td>
        <td class="right">₹${item.total.toFixed(2)}</td>
      </tr>
    `).join('')}
  </table>
  
  <div class="divider"></div>
  
  <table>
    <tr>
      <td>Subtotal:</td>
      <td class="right">₹${data.subtotal.toFixed(2)}</td>
    </tr>
    ${data.tax ? `
    <tr>
      <td>Tax:</td>
      <td class="right">₹${data.tax.toFixed(2)}</td>
    </tr>
    ` : ''}
    ${data.discount ? `
    <tr>
      <td>Discount:</td>
      <td class="right">-₹${data.discount.toFixed(2)}</td>
    </tr>
    ` : ''}
    <tr class="total-row">
      <td>Total:</td>
      <td class="right">₹${data.total.toFixed(2)}</td>
    </tr>
  </table>
  
  <div class="divider"></div>
  
  <div class="bold">Payment:</div>
  <table>
    ${data.payments.map(payment => `
      <tr>
        <td>${payment.method}</td>
        <td class="right">₹${payment.amount.toFixed(2)}</td>
      </tr>
    `).join('')}
  </table>
  
  ${data.changeDue ? `
  <table>
    <tr>
      <td>Change:</td>
      <td class="right">₹${data.changeDue.toFixed(2)}</td>
    </tr>
  </table>
  ` : ''}
  
  <div class="divider"></div>
  
  <div class="center footer">
    ${data.footer || 'Thank you for your business!'}
  </div>
  
  <div class="center no-print" style="margin-top: 20px;">
    <button onclick="window.print()">Print Receipt</button>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Format receipt as plain text
 */
export function formatReceiptPlainText(data: ReceiptData, width: number = 42): string {
  const lines: string[] = []
  
  // Helper functions
  const centerText = (text: string) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2))
    return ' '.repeat(padding) + text
  }
  
  const rightAlign = (left: string, right: string) => {
    const spaces = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(spaces) + right
  }
  
  const divider = () => '-'.repeat(width)
  
  // Header
  lines.push(centerText(data.orgName))
  if (data.orgAddress) lines.push(centerText(data.orgAddress))
  if (data.orgPhone) lines.push(centerText(`Tel: ${data.orgPhone}`))
  if (data.orgTax) lines.push(centerText(`Tax ID: ${data.orgTax}`))
  lines.push(divider())
  
  // Receipt info
  const dateFormatted = new Date(data.issuedAt).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  lines.push(`Receipt: ${data.receiptNumber}`)
  lines.push(`Date: ${dateFormatted}`)
  if (data.cashierName) lines.push(`Cashier: ${data.cashierName}`)
  if (data.laneId) lines.push(`Lane: ${data.laneId}`)
  lines.push(divider())
  
  // Items
  data.items.forEach(item => {
    const nameLine = item.name.length > width - 12 
      ? item.name.substring(0, width - 15) + '...'
      : item.name
    lines.push(nameLine)
    lines.push(rightAlign(
      `${item.quantity} x ₹${item.unitPrice.toFixed(2)}`,
      `₹${item.total.toFixed(2)}`
    ))
  })
  
  lines.push(divider())
  
  // Totals
  lines.push(rightAlign('Subtotal:', `₹${data.subtotal.toFixed(2)}`))
  if (data.tax) {
    lines.push(rightAlign('Tax:', `₹${data.tax.toFixed(2)}`))
  }
  if (data.discount) {
    lines.push(rightAlign('Discount:', `-₹${data.discount.toFixed(2)}`))
  }
  lines.push(rightAlign('TOTAL:', `₹${data.total.toFixed(2)}`))
  
  lines.push(divider())
  
  // Payments
  lines.push('Payment:')
  data.payments.forEach(payment => {
    lines.push(rightAlign(payment.method, `₹${payment.amount.toFixed(2)}`))
  })
  
  if (data.changeDue) {
    lines.push(rightAlign('Change:', `₹${data.changeDue.toFixed(2)}`))
  }
  
  lines.push(divider())
  lines.push(centerText(data.footer || 'Thank you for your business!'))
  lines.push('')
  
  return lines.join('\n')
}

/**
 * Generate ESC/POS commands for thermal printer
 * Supports basic ESC/POS standard commands
 */
export function generateESCPOS(data: ReceiptData, config: PrinterConfig): Buffer {
  const commands: number[] = []
  
  // ESC/POS command constants
  const ESC = 0x1b
  const GS = 0x1d
  const LF = 0x0a
  
  // Initialize printer
  commands.push(ESC, 0x40) // ESC @ - Initialize
  
  // Set alignment center
  const setAlignCenter = () => commands.push(ESC, 0x61, 0x01)
  const setAlignLeft = () => commands.push(ESC, 0x61, 0x00)
  
  // Set text emphasis
  const setBold = (enable: boolean) => commands.push(ESC, 0x45, enable ? 0x01 : 0x00)
  
  // Set text size
  const setTextSize = (width: number, height: number) => {
    const size = ((width - 1) << 4) | (height - 1)
    commands.push(GS, 0x21, size)
  }
  
  // Print text
  const printText = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      commands.push(text.charCodeAt(i))
    }
  }
  
  const printLine = (text: string) => {
    printText(text)
    commands.push(LF)
  }
  
  const feed = (lines: number = 1) => {
    for (let i = 0; i < lines; i++) {
      commands.push(LF)
    }
  }
  
  // Header
  setAlignCenter()
  setTextSize(2, 2)
  setBold(true)
  printLine(data.orgName)
  
  setTextSize(1, 1)
  setBold(false)
  if (data.orgAddress) printLine(data.orgAddress)
  if (data.orgPhone) printLine(`Tel: ${data.orgPhone}`)
  if (data.orgTax) printLine(`Tax ID: ${data.orgTax}`)
  
  feed(1)
  printLine('-'.repeat(config.characterWidth || 42))
  
  // Receipt info
  setAlignLeft()
  const dateFormatted = new Date(data.issuedAt).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  printLine(`Receipt: ${data.receiptNumber}`)
  printLine(`Date: ${dateFormatted}`)
  if (data.cashierName) printLine(`Cashier: ${data.cashierName}`)
  if (data.laneId) printLine(`Lane: ${data.laneId}`)
  
  printLine('-'.repeat(config.characterWidth || 42))
  
  // Items
  data.items.forEach(item => {
    printLine(item.name)
    const qtyPrice = `${item.quantity} x Rs${item.unitPrice.toFixed(2)}`
    const total = `Rs${item.total.toFixed(2)}`
    const spaces = Math.max(1, (config.characterWidth || 42) - qtyPrice.length - total.length)
    printLine(qtyPrice + ' '.repeat(spaces) + total)
  })
  
  printLine('-'.repeat(config.characterWidth || 42))
  
  // Totals
  const printTotal = (label: string, amount: string) => {
    const spaces = Math.max(1, (config.characterWidth || 42) - label.length - amount.length)
    printLine(label + ' '.repeat(spaces) + amount)
  }
  
  printTotal('Subtotal:', `Rs${data.subtotal.toFixed(2)}`)
  if (data.tax) printTotal('Tax:', `Rs${data.tax.toFixed(2)}`)
  if (data.discount) printTotal('Discount:', `-Rs${data.discount.toFixed(2)}`)
  
  setBold(true)
  printTotal('TOTAL:', `Rs${data.total.toFixed(2)}`)
  setBold(false)
  
  printLine('-'.repeat(config.characterWidth || 42))
  
  // Payments
  printLine('Payment:')
  data.payments.forEach(payment => {
    printTotal(payment.method, `Rs${payment.amount.toFixed(2)}`)
  })
  
  if (data.changeDue) {
    printTotal('Change:', `Rs${data.changeDue.toFixed(2)}`)
  }
  
  printLine('-'.repeat(config.characterWidth || 42))
  
  // Footer
  setAlignCenter()
  printLine(data.footer || 'Thank you for your business!')
  
  feed(3)
  
  // Cut paper (if supported)
  commands.push(GS, 0x56, 0x00) // GS V 0 - Full cut
  
  return Buffer.from(commands)
}

/**
 * Format complete receipt with all formats
 */
export function formatReceipt(
  data: ReceiptData,
  config: PrinterConfig
): FormattedReceipt {
  return {
    html: formatReceiptHTML(data),
    plainText: formatReceiptPlainText(data, config.characterWidth || 42),
    escpos: config.type === 'thermal' ? generateESCPOS(data, config) : undefined,
  }
}
