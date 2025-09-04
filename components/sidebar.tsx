"use client"

import { useState } from "react"
import {
  BarChart3,
  ShoppingCart,
  Package,
  Zap,
  Bot,
  Settings,
  Users,
  CreditCard,
  TrendingUp,
  Database,
} from "lucide-react"
// Assistant panel is now hosted by `VendaiPanel` which listens for the
// global 'vendai:open-assistant' event. The sidebar should dispatch that
// event instead of rendering its own assistant instance.

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, active: true },
  { id: "pos", label: "Point of Sale", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "integrations", label: "Integrations", icon: Zap },
  { id: "database", label: "Database", icon: Database },
]

const aiFeatures = [
  { id: "assistant", label: "AI Assistant", icon: Bot, active: true },
  { id: "settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const [activeItem, setActiveItem] = useState("dashboard")

  return (
    <div className="flex">
      <div className="w-64 glass border-r border-slate-700/50 flex flex-col">
        {/* Header */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-green-400 font-mono text-sm ml-2">vendai.pos</span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 p-4">
        <div className="mb-6">
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-mono">Main Navigation</h3>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItem(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    activeItem === item.id
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {activeItem === item.id && <div className="w-2 h-2 rounded-full bg-green-500 ml-auto"></div>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* AI Features */}
        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-mono">AI Features</h3>
          <nav className="space-y-1">
            {aiFeatures.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'assistant') {
                      try { window.dispatchEvent(new Event('vendai:open-assistant')) } catch (e) {}
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    item.active
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }`}
                  aria-expanded={item.id === "assistant" ? undefined : undefined}
                  aria-controls={item.id === "assistant" ? "ai-assistant-panel" : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.active && (
                    <div className="w-2 h-2 rounded-full bg-green-500 ml-auto"></div>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* System Status */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="glass-light rounded-lg p-3">
          <div className="text-xs font-mono text-slate-400 mb-1">system.status()</div>
          <div className="text-xs text-green-400">→ all systems operational</div>
          <div className="text-xs text-green-400">→ ai models: online</div>
        </div>
      </div>
  </div>
    </div>
  )
}
