const { app, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs').promises

function decodeEscPos(base64) {
  try {
    return Buffer.from(base64, 'base64')
  } catch (error) {
    throw new Error('Invalid ESC/POS payload provided: unable to decode base64.')
  }
}

async function persistCommands(buffer, jobName) {
  const baseDir = path.join(app.getPath('temp'), 'vendai-pos', 'receipts')
  await fs.mkdir(baseDir, { recursive: true })
  const filePath = path.join(baseDir, `${jobName}.bin`)
  await fs.writeFile(filePath, buffer)
  return filePath
}

async function dispatchToPrinter(buffer) {
  // Placeholder for actual printer integration. In production we should
  // stream the buffer directly to the connected printer port or driver.
  return buffer.length
}

function registerReceiptPrinterIpc() {
  ipcMain.handle('receipt-printer:print-escpos', async (_event, payload) => {
    if (!payload || typeof payload.commandsBase64 !== 'string' || payload.commandsBase64.length === 0) {
      throw new Error('ESC/POS commands payload is required.')
    }

    const buffer = decodeEscPos(payload.commandsBase64)
    const jobName = (payload.jobName || `receipt-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '-')

    const [bytesPersisted, filePath] = await Promise.all([
      dispatchToPrinter(buffer),
      persistCommands(buffer, jobName),
    ])

    return {
      success: true,
      bytes: bytesPersisted,
      filePath,
      jobName,
    }
  })
}

module.exports = { registerReceiptPrinterIpc }
