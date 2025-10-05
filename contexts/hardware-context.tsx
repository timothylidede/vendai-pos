'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'

type DeviceType = 'barcode-scanner' | 'cash-drawer' | 'card-reader'

export interface HardwareDevice {
	id: string
	label: string
	type: DeviceType
	connected: boolean
	simulated?: boolean
	transport?: string
	vendorId?: number
	productId?: number
	path?: string
	lastSeenAt?: number
	error?: string | null
}

export interface HardwareStatus {
	scanners: HardwareDevice[]
	cashDrawers: HardwareDevice[]
	cardReaders: HardwareDevice[]
	updatedAt: number
}

export interface HardwareScannerPayload {
	deviceId?: string
	data: string
	at: number
	simulated?: boolean
}

type HardwareRendererEvent = {
	type: string
	payload?: unknown
}

export interface CardTransactionProgress {
	status: 'idle' | 'initiated' | 'processing' | 'approved' | 'declined' | 'cancelled' | 'error'
	message?: string
	readerId?: string
	referenceId?: string
	error?: string
}

interface CardTransactionRequest {
	readerId?: string
	orderId?: string
	amount: number
	currency?: string
	metadata?: Record<string, unknown>
}

interface CardTransactionResponse {
	success: boolean
	status?: CardTransactionProgress['status'] | 'processing' | 'idle'
	referenceId?: string
	message?: string
	error?: string
}

interface HardwareContextValue {
	hardwareAvailable: boolean
	status: HardwareStatus
	refreshing: boolean
	lastScan: HardwareScannerPayload | null
	transaction: CardTransactionProgress
	refreshDevices: () => Promise<void>
	openCashDrawer: (deviceId?: string | null) => Promise<boolean>
	startCardTransaction: (request: CardTransactionRequest) => Promise<CardTransactionResponse>
	cancelCardTransaction: (reason?: string) => Promise<CardTransactionResponse>
	subscribeToScans: (listener: (payload: HardwareScannerPayload) => void) => () => void
}

const defaultSnapshot: HardwareStatus = {
	scanners: [],
	cashDrawers: [],
	cardReaders: [],
	updatedAt: Date.now(),
}

const defaultTransaction: CardTransactionProgress = {
	status: 'idle',
}

const noopAsync = async () => {}
const noopBoolean = async () => false
const noopSubscribe = () => () => {}

const HardwareContext = createContext<HardwareContextValue>({
	hardwareAvailable: false,
	status: defaultSnapshot,
	refreshing: false,
	lastScan: null,
	transaction: defaultTransaction,
	refreshDevices: noopAsync,
	openCashDrawer: noopBoolean,
	startCardTransaction: async () => ({ success: false, status: 'idle', error: 'Hardware bridge unavailable.' }),
	cancelCardTransaction: async () => ({ success: false, status: 'idle', message: 'No transaction to cancel.' }),
	subscribeToScans: noopSubscribe,
})

const simulatedSnapshot: HardwareStatus = {
	scanners: [
		{
			id: 'keyboard-fallback',
			label: 'Keyboard Scanner',
			type: 'barcode-scanner',
			connected: true,
			simulated: true,
			transport: 'keyboard',
			lastSeenAt: Date.now(),
		},
	],
	cashDrawers: [
		{
			id: 'simulated-drawer',
			label: 'Simulated Cash Drawer',
			type: 'cash-drawer',
			connected: true,
			simulated: true,
			transport: 'simulated',
			lastSeenAt: Date.now(),
		},
	],
	cardReaders: [
		{
			id: 'simulated-card-reader',
			label: 'DemoPay Simulated Reader',
			type: 'card-reader',
			connected: true,
			simulated: true,
			transport: 'simulated',
			lastSeenAt: Date.now(),
		},
	],
	updatedAt: Date.now(),
}

const normalizeDevice = (device: Partial<HardwareDevice> | null | undefined, fallbackType: DeviceType): HardwareDevice => {
	if (!device) {
		return {
			id: `${fallbackType}-${Math.random().toString(36).slice(2, 8)}`,
			label: 'Device',
			type: fallbackType,
			connected: false,
			lastSeenAt: Date.now(),
		}
	}

	return {
		id: device.id ?? `${fallbackType}-${Math.random().toString(36).slice(2, 8)}`,
		label: device.label ?? 'Device',
		type: (device.type as DeviceType) ?? fallbackType,
		connected: typeof device.connected === 'boolean' ? device.connected : true,
		simulated: Boolean(device.simulated),
		transport: device.transport,
		vendorId: device.vendorId,
		productId: device.productId,
		path: device.path,
		lastSeenAt: device.lastSeenAt ?? Date.now(),
		error: device.error ?? null,
	}
}

const normalizeSnapshot = (snapshot?: Partial<HardwareStatus> | null): HardwareStatus => {
	if (!snapshot) {
		return simulatedSnapshot
	}

	const updatedAt = typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : Date.now()

	return {
		scanners: Array.isArray(snapshot.scanners)
			? snapshot.scanners.map((device) => normalizeDevice(device, 'barcode-scanner'))
			: simulatedSnapshot.scanners,
		cashDrawers: Array.isArray(snapshot.cashDrawers)
			? snapshot.cashDrawers.map((device) => normalizeDevice(device, 'cash-drawer'))
			: simulatedSnapshot.cashDrawers,
		cardReaders: Array.isArray(snapshot.cardReaders)
			? snapshot.cardReaders.map((device) => normalizeDevice(device, 'card-reader'))
			: simulatedSnapshot.cardReaders,
		updatedAt,
	}
}

export function HardwareProvider({ children }: { children: ReactNode }) {
	const hardwareApiRef = useRef<Window['electronAPI']['hardware'] | undefined>(undefined)
	const [hardwareAvailable, setHardwareAvailable] = useState(false)
	const [status, setStatus] = useState<HardwareStatus>(() => simulatedSnapshot)
	const [refreshing, setRefreshing] = useState(false)
	const [lastScan, setLastScan] = useState<HardwareScannerPayload | null>(null)
	const [transaction, setTransaction] = useState<CardTransactionProgress>(defaultTransaction)

	const scanListeners = useRef(new Set<(payload: HardwareScannerPayload) => void>())

	const emitScan = useCallback((payload: HardwareScannerPayload) => {
		if (!payload || typeof payload.data !== 'string' || payload.data.trim().length === 0) {
			return
		}
		const enriched: HardwareScannerPayload = {
			...payload,
			at: payload.at ?? Date.now(),
		}
		setLastScan(enriched)
		scanListeners.current.forEach((listener) => {
			try {
				listener(enriched)
			} catch (error) {
				console.warn('[hardware] scanner listener failed', error)
			}
		})
	}, [])

	const subscribeToScans = useCallback((listener: (payload: HardwareScannerPayload) => void) => {
		scanListeners.current.add(listener)
		return () => {
			scanListeners.current.delete(listener)
		}
	}, [])

	const applySnapshot = useCallback((snapshot?: Partial<HardwareStatus> | null) => {
		const normalized = normalizeSnapshot(snapshot)
		setStatus(normalized)
	}, [])

	const refreshDevices = useCallback(async () => {
		const api = hardwareApiRef.current
		if (!api || typeof api.getStatus !== 'function') {
			applySnapshot(simulatedSnapshot)
			setHardwareAvailable(false)
			return
		}

		setRefreshing(true)
		try {
			const snapshot = await api.refreshDevices?.()
			applySnapshot(snapshot)
			setHardwareAvailable(true)
		} catch (error) {
			console.warn('[hardware] refresh failed, using simulated snapshot', error)
			applySnapshot(simulatedSnapshot)
			setHardwareAvailable(false)
		} finally {
			setRefreshing(false)
		}
	}, [applySnapshot])

	const handleScannerData = useCallback(
		(payload: HardwareScannerPayload) => {
			emitScan(payload)
		},
		[emitScan],
	)

	const handleHardwareEvent = useCallback(
		(event: HardwareRendererEvent) => {
			if (!event) return
			switch (event.type) {
				case 'devices:updated':
					applySnapshot(event.payload as HardwareStatus)
					break
				case 'scanner:scan':
					handleScannerData((event.payload as HardwareScannerPayload) ?? null)
					break
				case 'card:transaction': {
					const payload = event.payload as {
						status?: CardTransactionProgress['status']
						message?: string
						readerId?: string
						referenceId?: string
						error?: string
					}
					if (payload) {
						setTransaction((prev) => ({
							status: (payload.status as CardTransactionProgress['status']) ?? prev.status,
							message: payload.message,
							readerId: payload.readerId,
							referenceId: payload.referenceId,
							error: payload.error,
						}))
					}
					break
				}
				case 'cash-drawer:status':
					applySnapshot((event.payload as HardwareStatus) ?? status)
					break
				default:
					break
			}
		},
		[applySnapshot, handleScannerData, status],
	)

	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}
		hardwareApiRef.current = window.electronAPI?.hardware
		setHardwareAvailable(Boolean(hardwareApiRef.current))
	}, [])

	useEffect(() => {
		const api = hardwareApiRef.current
		if (!api) {
			setHardwareAvailable(false)
			applySnapshot(simulatedSnapshot)
			return
		}

		let offEvent: (() => void) | undefined
		let offScanner: (() => void) | undefined

		try {
			offEvent = api.onEvent?.((event) => handleHardwareEvent(event))
			offScanner = api.onScannerData?.((payload) => handleScannerData(payload))
		} catch (error) {
			console.warn('[hardware] failed to attach IPC listeners', error)
		}

		refreshDevices()

		return () => {
			offEvent?.()
			offScanner?.()
		}
	}, [applySnapshot, handleHardwareEvent, handleScannerData, refreshDevices])

	useEffect(() => {
		if (hardwareApiRef.current) {
			return
		}

		applySnapshot(simulatedSnapshot)

		let buffer = ''
		let lastTime = Date.now()

		const threshold = 60

		const handler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			const tagName = target?.tagName?.toLowerCase()
			const isEditable = Boolean(target?.isContentEditable)
			const acceptsScanner = Boolean(target && (target as HTMLElement).dataset?.barcodeTarget === 'true')

			if (!acceptsScanner && (tagName === 'input' || tagName === 'textarea' || isEditable)) {
				return
			}

			const now = Date.now()
			if (now - lastTime > threshold) {
				buffer = ''
			}
			lastTime = now

			if (event.key === 'Enter') {
				if (buffer.length > 0) {
					emitScan({
						deviceId: 'keyboard-fallback',
						data: buffer,
						at: now,
						simulated: true,
					})
					buffer = ''
				}
				return
			}

			if (event.key.length === 1) {
				buffer += event.key
			}
		}

		window.addEventListener('keydown', handler)
		return () => {
			window.removeEventListener('keydown', handler)
		}
	}, [applySnapshot, emitScan])

	const openCashDrawer = useCallback(async (deviceId?: string | null) => {
		const api = hardwareApiRef.current
		if (!api?.openCashDrawer) {
			console.info('[hardware] cash drawer bridge unavailable, using simulated success')
			return true
		}

		try {
			const response = await api.openCashDrawer(deviceId ?? null)
			if (!response?.success) {
				throw new Error(response?.error || 'Drawer trigger failed')
			}
			return true
		} catch (error) {
			console.error('[hardware] openCashDrawer failed', error)
			return false
		}
	}, [])

	const startCardTransaction = useCallback(async (request: CardTransactionRequest) => {
		const api = hardwareApiRef.current
		setTransaction({ status: 'processing', readerId: request.readerId })
		if (!api?.startCardTransaction) {
			console.warn('[hardware] card reader bridge unavailable')
			const fallbackRef = `SIM-${Date.now().toString(36).toUpperCase()}`
			setTransaction({
				status: 'approved',
				readerId: request.readerId,
				referenceId: fallbackRef,
				message: 'Simulated approval',
			})
			return {
				success: true,
				status: 'approved',
				referenceId: fallbackRef,
				message: 'Simulated approval',
			}
		}

		try {
			const response = await api.startCardTransaction(request)
			setTransaction({
				status: (response.status as CardTransactionProgress['status']) || (response.success ? 'approved' : 'declined'),
				readerId: request.readerId,
				referenceId: response.referenceId,
				message: response.message,
				error: response.error,
			})
			return response
		} catch (error) {
			console.error('[hardware] startCardTransaction failed', error)
			setTransaction({
				status: 'error',
				readerId: request.readerId,
				error: error instanceof Error ? error.message : 'Card transaction failed.',
			})
			return {
				success: false,
				status: 'error',
				error: error instanceof Error ? error.message : 'Card transaction failed.',
			}
		}
	}, [])

	const cancelCardTransaction = useCallback(async (reason?: string) => {
		const api = hardwareApiRef.current
		if (!api?.cancelCardTransaction) {
			setTransaction({ status: 'idle' })
			return {
				success: true,
				status: 'idle',
				message: 'No hardware transaction to cancel.',
			}
		}

		try {
			const response = await api.cancelCardTransaction(reason)
			setTransaction({
				status: (response.status as CardTransactionProgress['status']) || 'cancelled',
				message: response.message,
				error: response.error,
			})
			return response
		} catch (error) {
			console.error('[hardware] cancelCardTransaction failed', error)
			setTransaction({ status: 'error', error: error instanceof Error ? error.message : 'Cancel failed.' })
			return {
				success: false,
				status: 'error',
				error: error instanceof Error ? error.message : 'Cancel failed.',
			}
		}
	}, [])

	const value = useMemo<HardwareContextValue>(
		() => ({
			hardwareAvailable,
			status,
			refreshing,
			lastScan,
			transaction,
			refreshDevices,
			openCashDrawer,
			startCardTransaction,
			cancelCardTransaction,
			subscribeToScans,
		}),
		[
			hardwareAvailable,
			status,
			refreshing,
			lastScan,
			transaction,
			refreshDevices,
			openCashDrawer,
			startCardTransaction,
			cancelCardTransaction,
			subscribeToScans,
		],
	)

	return <HardwareContext.Provider value={value}>{children}</HardwareContext.Provider>
}

export const useHardware = () => useContext(HardwareContext)

export const useHardwareScans = () => {
	const { subscribeToScans, lastScan } = useHardware()
	return { subscribeToScans, lastScan }
}

export const useHardwareStatus = () => {
	const { hardwareAvailable, status, refreshing, transaction } = useHardware()
	return { hardwareAvailable, status, refreshing, transaction }
}
