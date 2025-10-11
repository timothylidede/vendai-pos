'use client'

/**
 * Webhook Management UI Component
 * Configure webhooks for external POS synchronization
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Power, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { POSSyncWebhookConfig, WebhookEventType } from '@/types/pos-sync'

interface WebhookManagerProps {
  orgId: string
  onClose?: () => void
}

const EVENT_OPTIONS: { value: WebhookEventType; label: string; description: string }[] = [
  { 
    value: 'stock.updated', 
    label: 'Stock Updated', 
    description: 'Triggered when inventory quantities change' 
  },
  { 
    value: 'price.updated', 
    label: 'Price Updated', 
    description: 'Triggered when product prices change' 
  },
  { 
    value: 'product.created', 
    label: 'Product Created', 
    description: 'Triggered when new products are added' 
  },
  { 
    value: 'product.updated', 
    label: 'Product Updated', 
    description: 'Triggered when product details change' 
  },
  { 
    value: 'product.deleted', 
    label: 'Product Deleted', 
    description: 'Triggered when products are removed' 
  },
]

export function WebhookManager({ orgId, onClose }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<POSSyncWebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    enabled: true,
    events: ['stock.updated', 'price.updated'] as WebhookEventType[],
  })

  useEffect(() => {
    fetchWebhooks()
  }, [orgId])

  const fetchWebhooks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pos/webhooks?orgId=${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.webhooks)
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error)
    }
    setLoading(false)
  }

  const handleCreateWebhook = async () => {
    if (!formData.name || !formData.url) {
      alert('Name and URL are required')
      return
    }

    try {
      const res = await fetch('/api/pos/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          ...formData,
        }),
      })

      if (res.ok) {
        await fetchWebhooks()
        setShowForm(false)
        setFormData({
          name: '',
          url: '',
          secret: '',
          enabled: true,
          events: ['stock.updated', 'price.updated'],
        })
      } else {
        const data = await res.json()
        alert(`Failed to create webhook: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleToggleEnabled = async (webhook: POSSyncWebhookConfig) => {
    try {
      const res = await fetch(`/api/pos/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      })

      if (res.ok) {
        await fetchWebhooks()
      }
    } catch (error) {
      console.error('Failed to toggle webhook:', error)
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook configuration?')) {
      return
    }

    try {
      const res = await fetch(`/api/pos/webhooks/${webhookId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchWebhooks()
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error)
    }
  }

  const handleTestWebhook = async (webhookId: string) => {
    setTestingId(webhookId)
    setTestResult(null)

    try {
      const res = await fetch('/api/pos/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId }),
      })

      const data = await res.json()

      setTestResult({
        id: webhookId,
        success: data.success,
        message: data.message || data.error || 'Unknown error',
      })
    } catch (error: any) {
      setTestResult({
        id: webhookId,
        success: false,
        message: error.message,
      })
    }

    setTestingId(null)
  }

  const handleEventToggle = (event: WebhookEventType) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Webhook Configuration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure external POS system synchronization
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Webhook Button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Webhook
            </button>
          )}

          {/* Webhook Form */}
          {showForm && (
            <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">New Webhook Configuration</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My External POS System"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://your-pos-system.com/webhooks/vendai"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret Key (optional)
                  </label>
                  <input
                    type="password"
                    value={formData.secret}
                    onChange={e => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                    placeholder="Used for HMAC signature verification"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: Generate a strong secret for webhook signature verification
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Events to Subscribe
                  </label>
                  <div className="space-y-2">
                    {EVENT_OPTIONS.map(event => (
                      <label key={event.value} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.value)}
                          onChange={() => handleEventToggle(event.value)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{event.label}</div>
                          <div className="text-sm text-gray-500">{event.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateWebhook}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Webhook
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Webhooks List */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No webhooks configured yet. Add one to enable external POS sync.
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map(webhook => (
                <div
                  key={webhook.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    webhook.enabled
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">{webhook.name}</h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            webhook.enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {webhook.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 font-mono">{webhook.url}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {webhook.events.map(event => (
                          <span
                            key={event}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                      {testResult?.id === webhook.id && (
                        <div
                          className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                            testResult.success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                          <span className="text-sm">{testResult.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleTestWebhook(webhook.id!)}
                        disabled={testingId === webhook.id}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Send test webhook"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(webhook)}
                        className={`p-2 rounded-lg transition-colors ${
                          webhook.enabled
                            ? 'text-green-600 hover:bg-green-100'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        title={webhook.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id!)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 mb-1">Webhook Security</p>
              <p>
                All webhook payloads include an HMAC SHA-256 signature in the{' '}
                <code className="px-1 py-0.5 bg-gray-200 rounded text-xs">X-VendAI-Signature</code>{' '}
                header. Verify this signature using your secret key to ensure authenticity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
