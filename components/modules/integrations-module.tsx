"use client"

import { useState } from "react"
import { Zap, CheckCircle, AlertCircle, Plus, Settings } from "lucide-react"

const integrations = [
  {
    id: "1",
    name: "M-Pesa",
    description: "Mobile money payments",
    status: "connected",
    icon: "💳",
    config: { tillNumber: "123456", apiKey: "***" },
  },
  {
    id: "2",
    name: "WhatsApp Business",
    description: "Customer notifications",
    status: "connected",
    icon: "💬",
    config: { phoneNumber: "+254700000000" },
  },
  {
    id: "3",
    name: "Supplier API",
    description: "Automated ordering",
    status: "pending",
    icon: "🚚",
    config: {},
  },
  {
    id: "4",
    name: "KRA eTIMS",
    description: "Tax compliance",
    status: "disconnected",
    icon: "📊",
    config: {},
  },
]

const availableIntegrations = [
  { name: "Airtel Money", description: "Mobile payments", icon: "💰" },
  { name: "Equity Bank API", description: "Banking integration", icon: "🏦" },
  { name: "Jumia Logistics", description: "Delivery service", icon: "📦" },
  { name: "Google Analytics", description: "Business insights", icon: "📈" },
]

export function IntegrationsModule() {
  const [showAddIntegration, setShowAddIntegration] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-400 bg-green-500/20 border-green-500/30"
      case "pending":
        return "text-orange-400 bg-orange-500/20 border-orange-500/30"
      case "disconnected":
        return "text-red-400 bg-red-500/20 border-red-500/30"
      default:
        return "text-slate-400 bg-slate-500/20 border-slate-500/30"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-4 h-4" />
      case "pending":
        return <AlertCircle className="w-4 h-4" />
      case "disconnected":
        return <AlertCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-200 mb-2">Integrations</h2>
          <p className="text-slate-400">Connect vendai with your business tools</p>
        </div>
        <button
          onClick={() => setShowAddIntegration(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Integration</span>
        </button>
      </div>

      {/* Active Integrations */}
      <div className="glass rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Active Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="glass-light rounded-lg p-4 border border-slate-600/30">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{integration.icon}</div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{integration.name}</div>
                    <div className="text-xs text-slate-400">{integration.description}</div>
                  </div>
                </div>
                <div
                  className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(integration.status)}`}
                >
                  {getStatusIcon(integration.status)}
                  <span className="capitalize">{integration.status}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {Object.keys(integration.config).length} settings configured
                </div>
                <div className="flex space-x-2">
                  <button className="p-1 rounded bg-slate-700/50 hover:bg-slate-600/50 transition-colors">
                    <Settings className="w-3 h-3 text-slate-400" />
                  </button>
                  {integration.status === "connected" && (
                    <button className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/30 hover:bg-red-500/30 transition-colors">
                      Disconnect
                    </button>
                  )}
                  {integration.status === "pending" && (
                    <button className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30 hover:bg-green-500/30 transition-colors">
                      Complete
                    </button>
                  )}
                  {integration.status === "disconnected" && (
                    <button className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30 hover:bg-green-500/30 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Integrations */}
      {showAddIntegration && (
        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-200">Available Integrations</h3>
            <button
              onClick={() => setShowAddIntegration(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableIntegrations.map((integration, index) => (
              <div
                key={index}
                className="glass-light rounded-lg p-4 border border-slate-600/30 hover:border-green-500/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="text-2xl">{integration.icon}</div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{integration.name}</div>
                    <div className="text-xs text-slate-400">{integration.description}</div>
                  </div>
                </div>
                <button className="w-full py-2 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30 hover:bg-green-500/30 transition-colors">
                  Add Integration
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integration Tips */}
      <div className="glass rounded-lg p-6 border border-blue-500/30 bg-blue-500/10">
        <div className="flex items-start space-x-3">
          <Zap className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-400 mb-2">Integration Tips</h4>
            <ul className="text-xs text-slate-300 space-y-1">
              <li>• Connect M-Pesa for seamless mobile payments</li>
              <li>• Enable WhatsApp notifications to keep customers informed</li>
              <li>• Set up supplier APIs for automated restocking</li>
              <li>• Integrate KRA eTIMS for tax compliance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
