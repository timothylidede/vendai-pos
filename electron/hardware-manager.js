const { BrowserWindow, ipcMain } = require('electron')
const { EventEmitter } = require('events')
const { BarcodeScannerManager } = require('./devices/barcode-scanner')
const { CashDrawerManager } = require('./devices/cash-drawer')
const { CardReaderManager } = require('./devices/card-reader')

const snapshotTemplate = () => ({
	scanners: [],
	cashDrawers: [],
	cardReaders: [],
	updatedAt: Date.now(),
})

const broadcast = (channel, payload) => {
	const windows = BrowserWindow.getAllWindows()
	for (const win of windows) {
		try {
			win.webContents.send(channel, payload)
		} catch (error) {
			console.warn('[hardware] failed to broadcast to renderer', error)
		}
	}
}

class HardwareManager extends EventEmitter {
	constructor() {
		super()
		this.scanner = new BarcodeScannerManager()
		this.cashDrawer = new CashDrawerManager()
		this.cardReader = new CardReaderManager()
		this.snapshot = snapshotTemplate()
		this.initialized = false

		this.scanner.on('scan', (payload) => {
			this.emit('scanner:scan', payload)
			this.emit('event', { type: 'scanner:scan', payload })
		})

		this.scanner.on('status', (payload) => {
			this.updateDeviceStatus('scanners', payload)
		})

		this.cashDrawer.on('status', (payload) => {
			this.updateDeviceStatus('cashDrawers', payload)
			this.emit('event', { type: 'cash-drawer:status', payload })
		})

		this.cashDrawer.on('trigger', (payload) => {
			this.emit('event', { type: 'cash-drawer:trigger', payload })
		})

		this.cardReader.on('transaction', (payload) => {
			this.emit('event', { type: 'card:transaction', payload })
		})
	}

	async initialize() {
		if (this.initialized) {
			return this.snapshot
		}
		this.initialized = true
		return this.refreshDevices()
	}

	getSnapshot() {
		return {
			scanners: [...this.snapshot.scanners],
			cashDrawers: [...this.snapshot.cashDrawers],
			cardReaders: [...this.snapshot.cardReaders],
			updatedAt: this.snapshot.updatedAt,
		}
	}

	async refreshDevices() {
		const [scanners, drawers, readers] = await Promise.all([
			this.scanner.discover(),
			this.cashDrawer.discover(),
			this.cardReader.discover(),
		])

		this.snapshot = {
			scanners: scanners.map((device) => this.normalizeDevice(device, 'barcode-scanner')),
			cashDrawers: drawers.map((device) => this.normalizeDevice(device, 'cash-drawer')),
			cardReaders: readers.map((device) => this.normalizeDevice(device, 'card-reader')),
			updatedAt: Date.now(),
		}

		await Promise.all(
			this.snapshot.scanners.map(async (scanner) => {
				try {
					await this.scanner.startListening(scanner.id)
				} catch (error) {
					console.warn('[hardware] scanner listen failed', error)
				}
			}),
		)

		this.emit('event', { type: 'devices:updated', payload: this.getSnapshot() })
		return this.getSnapshot()
	}

	normalizeDevice(device, fallbackType) {
		if (!device) {
			return {
				id: `${fallbackType}-unknown`,
				label: 'Unknown Device',
				type: fallbackType,
				connected: false,
			}
		}

		return {
			id: device.id,
			label: device.label || 'Unnamed Device',
			type: device.type || fallbackType,
			connected: typeof device.connected === 'boolean' ? device.connected : true,
			simulated: Boolean(device.simulated),
			transport: device.transport,
			vendorId: device.vendorId,
			productId: device.productId,
			path: device.path,
			lastSeenAt: Date.now(),
		}
	}

	updateDeviceStatus(groupName, payload) {
		if (!payload || !payload.deviceId) return

		const devices = [...(this.snapshot[groupName] || [])]
		const index = devices.findIndex((device) => device.id === payload.deviceId)
		const now = Date.now()

		if (index >= 0) {
			devices[index] = {
				...devices[index],
				connected: typeof payload.connected === 'boolean' ? payload.connected : devices[index].connected,
				simulated: typeof payload.simulated === 'boolean' ? payload.simulated : devices[index].simulated,
				lastSeenAt: now,
				error: payload.error || null,
				transport: payload.transport || devices[index].transport,
			}
		} else {
			devices.push({
				id: payload.deviceId,
				label: payload.label || 'Device',
				type: groupName === 'scanners' ? 'barcode-scanner' : groupName === 'cashDrawers' ? 'cash-drawer' : 'card-reader',
				connected: Boolean(payload.connected),
				simulated: Boolean(payload.simulated),
				transport: payload.transport,
				lastSeenAt: now,
				error: payload.error || null,
			})
		}

		this.snapshot = {
			...this.snapshot,
			[groupName]: devices,
			updatedAt: now,
		}

		this.emit('event', { type: 'devices:updated', payload: this.getSnapshot() })
	}

	async openCashDrawer(deviceId) {
		const result = await this.cashDrawer.open(deviceId)
		this.emit('event', { type: 'cash-drawer:opened', payload: result })
		return result
	}

	async startCardTransaction(request) {
		const result = await this.cardReader.startTransaction(request)
		return result
	}

	async cancelCardTransaction(reason) {
		return this.cardReader.cancelTransaction(reason)
	}

	async simulateScan(payload) {
		return this.scanner.simulateScan(payload)
	}
}

let managerSingleton = null
let registered = false

const getHardwareManager = () => {
	if (!managerSingleton) {
		managerSingleton = new HardwareManager()
	}
	return managerSingleton
}

const registerHardwareIpc = () => {
	if (registered) {
		return getHardwareManager()
	}

	const manager = getHardwareManager()
	manager.initialize().catch((error) => {
		console.warn('[hardware] initial scan failed', error)
	})

	ipcMain.handle('hardware:get-status', async () => manager.getSnapshot())
	ipcMain.handle('hardware:refresh-devices', async () => manager.refreshDevices())
	ipcMain.handle('hardware:cash-drawer-open', async (_event, deviceId) => manager.openCashDrawer(deviceId))
	ipcMain.handle('hardware:card-transaction-start', async (_event, payload) => manager.startCardTransaction(payload || {}))
	ipcMain.handle('hardware:card-transaction-cancel', async (_event, reason) => manager.cancelCardTransaction(reason))
	ipcMain.handle('hardware:simulate-scan', async (_event, payload) => manager.simulateScan(payload || {}))

	manager.on('event', (event) => {
		broadcast('hardware:event', event)
	})

	manager.on('scanner:scan', (payload) => {
		broadcast('hardware:scanner-data', payload)
	})

	registered = true
	return manager
}

module.exports = {
	getHardwareManager,
	registerHardwareIpc,
}
