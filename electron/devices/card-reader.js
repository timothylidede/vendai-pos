const { EventEmitter } = require('events')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CardReaderManager extends EventEmitter {
	constructor() {
		super()
		this.devices = [
			{
				id: 'simulated-card-reader',
				label: 'DemoPay Simulated Reader',
				type: 'card-reader',
				transport: 'simulated',
				connected: true,
				simulated: true,
			},
		]
		this.activeTransaction = null
	}

	async discover() {
		return this.devices
	}

	getDevices() {
		return this.devices
	}

	async startTransaction(request) {
		const {
			readerId,
			amount,
			currency = 'KES',
			orderId,
			metadata = {},
		} = request || {}

		const device = this.resolveDevice(readerId)
		if (!device) {
			const error = new Error('No card reader available.')
			this.emit('transaction', {
				status: 'error',
				error: error.message,
				readerId,
				orderId,
			})
			throw error
		}

		if (this.activeTransaction) {
			throw new Error('A card transaction is already in progress.')
		}

		this.activeTransaction = {
			readerId: device.id,
			amount,
			currency,
			orderId,
			startedAt: Date.now(),
		}

		this.emit('transaction', {
			status: 'initiated',
			readerId: device.id,
			orderId,
			amount,
			currency,
			simulated: Boolean(device.simulated),
		})

		await delay(1200)

		const shouldFail = metadata.forceDecline === true || metadata.simulateFailure === true
		const shouldCancel = metadata.forceCancel === true

		if (shouldCancel) {
			this.emit('transaction', {
				status: 'cancelled',
				readerId: device.id,
				orderId,
				amount,
				currency,
			})
			this.activeTransaction = null
			return {
				success: false,
				status: 'cancelled',
				message: 'Transaction cancelled by simulation flag.',
			}
		}

		if (shouldFail) {
			this.emit('transaction', {
				status: 'declined',
				readerId: device.id,
				orderId,
				amount,
				currency,
				error: 'Simulated decline',
			})
			this.activeTransaction = null
			return {
				success: false,
				status: 'declined',
				error: 'Card declined (simulated).',
			}
		}

		await delay(800)

		const referenceId = `SIM-${Date.now().toString(36).toUpperCase()}`
		this.emit('transaction', {
			status: 'approved',
			readerId: device.id,
			orderId,
			amount,
			currency,
			referenceId,
		})

		this.activeTransaction = null
		return {
			success: true,
			status: 'approved',
			referenceId,
			message: 'Approved (simulated reader)',
		}
	}

	async cancelTransaction(reason = 'Operator cancelled the transaction.') {
		if (!this.activeTransaction) {
			return { success: false, status: 'idle', message: 'No active transaction.' }
		}

		const snapshot = this.activeTransaction
		this.activeTransaction = null

		this.emit('transaction', {
			status: 'cancelled',
			readerId: snapshot.readerId,
			orderId: snapshot.orderId,
			amount: snapshot.amount,
			currency: snapshot.currency,
			message: reason,
		})

		return {
			success: true,
			status: 'cancelled',
			message: reason,
		}
	}

	resolveDevice(readerId) {
		if (readerId) {
			return this.devices.find((device) => device.id === readerId)
		}
		return this.devices[0]
	}
}

module.exports = {
	CardReaderManager,
}
