export type POSPaymentMethod =
	| 'cash'
	| 'card'
	| 'mobile_money'
	| 'bank_transfer'
	| 'voucher'
	| 'store_credit'
	| 'mixed'
	| 'other'

export type POSPaymentStatus =
	| 'pending'
	| 'authorized'
	| 'captured'
	| 'completed'
	| 'failed'
	| 'voided'
	| 'refunded'
	| 'cancelled'

export interface POSPayment {
	id?: string
	method: POSPaymentMethod
	/** Amount applied to the order total */
	amount: number
	/** Amount tendered by the customer. Can differ from `amount` when giving change */
	tenderedAmount?: number
	changeGiven?: number
	/** ISO8601 timestamp for when the payment attempt was recorded */
	receivedAt: string
	status: POSPaymentStatus
	referenceId?: string
	note?: string
	processedBy?: string
	metadata?: Record<string, unknown>
}

export interface POSReceiptPaymentLine {
	method: POSPaymentMethod
	amount: number
}

export interface POSReceipt {
	receiptNumber: string
	orderId: string
	orgId: string
	issuedAt: string
	issuedBy: string
	registerId?: string
	subtotal: number
	taxTotal?: number
	discountTotal?: number
	grandTotal: number
	payments: POSReceiptPaymentLine[]
	customer?: {
		id?: string
		name?: string
		phone?: string
		email?: string
	}
	documentUrls?: {
		pdf?: string
		html?: string
	}
	metadata?: Record<string, unknown>
}

export interface POSCheckoutContext {
	channel: 'pos_web' | 'pos_kiosk' | 'pos_mobile' | 'pos_edge' | string
	registerId?: string
	shiftId?: string
	deviceId?: string
	sessionId?: string
	location?: {
		storeId?: string
		name?: string
	}
	subtotal: number
	taxTotal?: number
	discountTotal?: number
	grandTotal: number
	changeDue?: number
	customer?: {
		id?: string
		name?: string
		phone?: string
		email?: string
	}
	notes?: string
	payments: POSPayment[]
	metadata?: Record<string, unknown>
}

export type POSOrderStatus = 'draft' | 'awaiting_payment' | 'paid' | 'void' | 'refunded'

export interface POSPaymentSummary {
	totalApplied: number
	totalTendered: number
	totalChange: number
	balanceDue: number
	lastPaymentAt?: string
}

export interface CreatePOSOrderOptions {
	payments?: POSPayment[]
	status?: POSOrderStatus
	receiptNumber?: string
	cashierId?: string
	completedAt?: string | null
	checkoutContext?: POSCheckoutContext
	receipt?: POSReceipt
	balanceDue?: number
	notes?: string
}
