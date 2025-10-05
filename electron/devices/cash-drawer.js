const { EventEmitter } = require('events')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CashDrawerManager extends EventEmitter {
	constructor() {
		super()
		this.devices = [
			{
				id: 'simulated-drawer',
				label: 'Simulated Cash Drawer',
				type: 'cash-drawer',
				transport: 'simulated',
				connected: true,
				simulated: true,
			},
		]
		this.statusById = new Map()
	}

	async discover() {
		return this.devices
	}

	getDevices() {
		return this.devices
	}

	getStatus(deviceId) {
		const id = deviceId || (this.devices[0] && this.devices[0].id)
		if (!id) {
			return { deviceId, opened: false, connected: false }
		}

		const status = this.statusById.get(id) || {
			deviceId: id,
			opened: false,
			connected: true,
			lastOpenedAt: null,
		}
		return status
	}

	async open(deviceId, options = {}) {
		const id = deviceId || (this.devices[0] && this.devices[0].id)
		if (!id) {
			const error = new Error('No cash drawer configured.')
			this.emit('warning', error)
			throw error
		}

		const status = this.getStatus(id)
		this.emit('trigger', {
			deviceId: id,
			method: options.method || 'simulated',
			metadata: options.metadata || null,
		})

		await delay(250)

		const now = Date.now()
		const nextStatus = {
			deviceId: id,
			opened: true,
			connected: true,
			lastOpenedAt: now,
		}

		this.statusById.set(id, nextStatus)
		this.emit('status', nextStatus)

		await delay(500)

		this.statusById.set(id, {
			...nextStatus,
			opened: false,
		})
		this.emit('status', {
			...nextStatus,
			opened: false,
		})

		return { success: true, deviceId: id, openedAt: now }
	}
}

module.exports = {
	CashDrawerManager,
}
