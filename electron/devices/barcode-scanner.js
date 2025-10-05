const { EventEmitter } = require('events')

let HID = null
let hidAvailable = false

try {
	// `node-hid` is optional. When unavailable we fall back to keyboard simulation.
	// eslint-disable-next-line import/no-extraneous-dependencies, global-require
	HID = require('node-hid')
	if (HID && typeof HID.devices === 'function') {
		hidAvailable = true
	}
} catch (error) {
	const message = error instanceof Error ? error.message : String(error)
	if (!/Cannot find module/.test(message)) {
		console.warn('[hardware][barcode] Unable to load node-hid; falling back to simulation.', message)
	}
	HID = null
}

const SHIFT_MASK = 0x22 // left shift (0x02) + right shift (0x20)

const KEYCODE_MAP = {
	4: 'a',
	5: 'b',
	6: 'c',
	7: 'd',
	8: 'e',
	9: 'f',
	10: 'g',
	11: 'h',
	12: 'i',
	13: 'j',
	14: 'k',
	15: 'l',
	16: 'm',
	17: 'n',
	18: 'o',
	19: 'p',
	20: 'q',
	21: 'r',
	22: 's',
	23: 't',
	24: 'u',
	25: 'v',
	26: 'w',
	27: 'x',
	28: 'y',
	29: 'z',
	30: '1',
	31: '2',
	32: '3',
	33: '4',
	34: '5',
	35: '6',
	36: '7',
	37: '8',
	38: '9',
	39: '0',
	40: 'ENTER',
	41: 'ESC',
	42: 'BACKSPACE',
	43: 'TAB',
	44: ' ',
	45: '-',
	46: '=',
	47: '[',
	48: ']',
	49: '\\',
	51: ';',
	52: "'",
	53: '`',
	54: ',',
	55: '.',
	56: '/',
}

const SHIFT_CHAR_OVERRIDES = {
	'1': '!',
	'2': '@',
	'3': '#',
	'4': '$',
	'5': '%',
	'6': '^',
	'7': '&',
	'8': '*',
	'9': '(',
	'0': ')',
	'-': '_',
	'=': '+',
	'[': '{',
	']': '}',
	'\\': '|',
	';': ':',
	"'": '"',
	'`': '~',
	',': '<',
	'.': '>',
	'/': '?',
}

const dedupeDevices = (devices) => {
	const seen = new Set()
	return devices.filter((device) => {
		const key = `${device.id}`
		if (seen.has(key)) {
			return false
		}
		seen.add(key)
		return true
	})
}

class BarcodeScannerManager extends EventEmitter {
	constructor() {
		super()
		this.hidAvailable = hidAvailable
		this.devices = []
		this.buffers = new Map()
		this.connections = new Map()
		this.simulatedDevice = {
			id: 'simulated-scanner',
			label: 'Keyboard / Simulated Scanner',
			type: 'barcode-scanner',
			transport: 'keyboard',
			connected: true,
			simulated: true,
		}
	}

	async discover() {
		const devices = []

		if (this.hidAvailable) {
			try {
				const list = HID.devices()
				for (const device of list) {
					if (!device) continue
					const product = (device.product || '').toLowerCase()
					const usagePage = typeof device.usagePage === 'number' ? device.usagePage : null
					const usage = typeof device.usage === 'number' ? device.usage : null

					const isLikelyScanner =
						(usagePage === 0x01 && usage === 0x06) || // Generic Desktop / Keyboard
						product.includes('scanner') ||
						product.includes('barcode')

					if (!isLikelyScanner) continue

					const idParts = [device.vendorId, device.productId, device.serialNumber || device.path]
					const id = idParts.filter(Boolean).join(':') || `hid-${Math.random().toString(36).slice(2, 9)}`

					devices.push({
						id,
						label: device.product || device.manufacturer || 'HID Barcode Scanner',
						type: 'barcode-scanner',
						transport: 'hid',
						connected: true,
						vendorId: device.vendorId,
						productId: device.productId,
						path: device.path,
					})
				}
			} catch (error) {
				console.warn('[hardware][barcode] HID discovery failed, falling back to simulation.', error)
			}
		}

		if (devices.length === 0) {
			devices.push(this.simulatedDevice)
		}

		this.devices = dedupeDevices(devices)
		return this.devices
	}

	getDevices() {
		return this.devices
	}

	ensureDiscovered() {
		if (!this.devices || this.devices.length === 0) {
			return this.discover()
		}
		return Promise.resolve(this.devices)
	}

	async startListening(deviceId) {
		await this.ensureDiscovered()
		const target = this.devices.find((device) => device.id === deviceId) || this.simulatedDevice

		if (target.simulated || !this.hidAvailable) {
			this.emit('status', {
				deviceId: target.id,
				connected: true,
				simulated: true,
				transport: target.transport,
			})
			return target
		}

		if (this.connections.has(target.id)) {
			return target
		}

		if (!target.path) {
			throw new Error('Unable to bind HID scanner: missing device path.')
		}

		try {
			const connection = new HID.HID(target.path)
			this.connections.set(target.id, connection)
			this.buffers.set(target.id, '')

			connection.on('data', (buffer) => {
				try {
					this.handleHidBuffer(target, buffer)
				} catch (error) {
					console.error('[hardware][barcode] Failed to decode HID buffer', error)
				}
			})

			connection.on('error', (error) => {
				console.error('[hardware][barcode] HID connection error', error)
				this.connections.delete(target.id)
				this.buffers.delete(target.id)
				this.emit('status', {
					deviceId: target.id,
					connected: false,
					error: error instanceof Error ? error.message : String(error),
				})
			})

			this.emit('status', {
				deviceId: target.id,
				connected: true,
			})
		} catch (error) {
			console.error('[hardware][barcode] Unable to open HID device', error)
			this.emit('status', {
				deviceId: target.id,
				connected: false,
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}

		return target
	}

	stopListening(deviceId) {
		const connection = this.connections.get(deviceId)
		if (connection && typeof connection.close === 'function') {
			try {
				connection.close()
			} catch (error) {
				console.warn('[hardware][barcode] Error closing HID connection', error)
			}
		}
		this.connections.delete(deviceId)
		this.buffers.delete(deviceId)
		this.emit('status', {
			deviceId,
			connected: false,
		})
	}

	simulateScan({ data, deviceId } = {}) {
		const payload = {
			deviceId: deviceId || this.simulatedDevice.id,
			data: typeof data === 'string' ? data : '',
			at: Date.now(),
			simulated: true,
		}
		if (payload.data.trim().length === 0) {
			return payload
		}
		this.emit('scan', payload)
		return payload
	}

	handleHidBuffer(device, buffer) {
		if (!Buffer.isBuffer(buffer)) {
			return
		}

		const isShifted = (buffer[0] & SHIFT_MASK) !== 0
		for (let idx = 2; idx < buffer.length; idx += 1) {
			const keyCode = buffer[idx]
			if (!keyCode) continue
			const char = this.decodeKeyCode(keyCode, isShifted)
			if (!char) continue
			this.appendCharacter(device, char)
		}
	}

	decodeKeyCode(code, isShifted) {
		const token = KEYCODE_MAP[code]
		if (!token) {
			return ''
		}

		if (token === 'ENTER') {
			return '\n'
		}
		if (token === 'TAB') {
			return '\t'
		}
		if (token === 'BACKSPACE') {
			return '\b'
		}
		if (token === 'ESC') {
			return ''
		}

		if (!isShifted) {
			return token
		}

		if (SHIFT_CHAR_OVERRIDES[token]) {
			return SHIFT_CHAR_OVERRIDES[token]
		}

		return token.length === 1 ? token.toUpperCase() : token
	}

	appendCharacter(device, char) {
		const current = this.buffers.get(device.id) || ''

		if (char === '\n') {
			const trimmed = current.trim()
			if (trimmed.length > 0) {
				this.emit('scan', {
					deviceId: device.id,
					data: trimmed,
					at: Date.now(),
					simulated: false,
				})
			}
			this.buffers.set(device.id, '')
			return
		}

		if (char === '\b') {
			this.buffers.set(device.id, current.slice(0, -1))
			return
		}

		this.buffers.set(device.id, `${current}${char}`)
	}
}

module.exports = {
	BarcodeScannerManager,
}
