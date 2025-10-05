'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject, RefCallback } from 'react'
import { useHardwareScans } from '@/contexts/hardware-context'

export interface UseScannerFocusOptions {
	targetRef?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
	onScan?: (code: string) => void
	onScanPayload?: (payload: { code: string; deviceId?: string; simulated?: boolean }) => void
	autoFocus?: boolean
	updateInputValue?: boolean
}

export interface UseScannerFocusResult {
	inputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
	attach: RefCallback<HTMLInputElement | HTMLTextAreaElement>
	focus: () => void
}

const defaultOptions: Required<Pick<UseScannerFocusOptions, 'autoFocus' | 'updateInputValue'>> = {
	autoFocus: true,
	updateInputValue: true,
}

export function useScannerFocus(options: UseScannerFocusOptions = {}): UseScannerFocusResult {
	const { subscribeToScans } = useHardwareScans()
	const fallbackRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
	const targetRef = options.targetRef ?? fallbackRef
	const config = { ...defaultOptions, ...options }

	const focus = useCallback(() => {
		const node = targetRef.current
		if (node && typeof node.focus === 'function') {
			node.focus({ preventScroll: true })
		}
	}, [targetRef])

	const attach: RefCallback<HTMLInputElement | HTMLTextAreaElement> = useCallback(
		(node) => {
			targetRef.current = node
			if (node) {
				node.dataset.barcodeTarget = 'true'
				node.setAttribute('autocomplete', 'off')
				node.setAttribute('inputmode', 'none')
				node.setAttribute('aria-label', node.getAttribute('aria-label') ?? 'Barcode input')
				if (config.autoFocus) {
					queueMicrotask(() => focus())
				}
			}
		},
		[targetRef, config.autoFocus, focus],
	)

	useEffect(() => {
		const unsubscribe = subscribeToScans((payload) => {
			if (!payload || typeof payload.data !== 'string') {
				return
			}

			const code = payload.data.trim()
			if (code.length === 0) {
				return
			}

			if (config.updateInputValue && targetRef.current) {
				const node = targetRef.current
				if ('value' in node) {
					const inputNode = node as HTMLInputElement | HTMLTextAreaElement
					inputNode.value = code
					const event = new Event('input', { bubbles: true })
					inputNode.dispatchEvent(event)
				}
			}

			options.onScan?.(code)
			options.onScanPayload?.({
				code,
				deviceId: payload.deviceId,
				simulated: payload.simulated,
			})

			focus()
		})

		return () => {
			unsubscribe()
		}
	}, [config.updateInputValue, focus, options, subscribeToScans, targetRef])

	useEffect(() => {
		if (!config.autoFocus) return
		const handleBlur = () => {
			window.setTimeout(() => focus(), 50)
		}

		const node = targetRef.current
		if (!node) return

		node.addEventListener('blur', handleBlur)
		return () => {
			node.removeEventListener('blur', handleBlur)
		}
	}, [config.autoFocus, focus, targetRef])

	return {
		inputRef: targetRef,
		attach,
		focus,
	}
}
