"use client"

import { useState, useEffect } from "react"
import { ShoppingCart, Package, TrendingUp, AlertTriangle } from "lucide-react"

const terminalLines = [
  { type: "command", text: "$ inventory.check()" },
  { type: "output", text: "→ 15 items need restocking.", color: "text-green-400" },
  { type: "command", text: "$ ai.suggest_order()" },
  { type: "output", text: "→ Order placed with best distributor.", color: "text-green-400" },
  { type: "command", text: "$ sales.analyze()" },
  { type: "output", text: "→ Revenue up 12% this week.", color: "text-orange-400" },
]

const metrics = [
  {
    title: "Today's Sales",
    value: "KSh 24,350",
    change: "+20.1% from yesterday",
    icon: ShoppingCart,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/30",
  },
  {
    title: "Low Stock Items",
    value: "15",
    change: "Need immediate restock",
    icon: Package,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/30",
  },
  {
    title: "Profit Margin",
    value: "32.5%",
    change: "+2.3% this week",
    icon: TrendingUp,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/30",
  },
  {
    title: "AI Actions",
    value: "7",
    change: "Pending your approval",
    icon: AlertTriangle,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
  },
]

const recentTransactions = [
  { item: "Coca Cola 500mL", time: "2 mins ago", amount: "KSh 60" },
  { item: "Bread White", time: "5 mins ago", amount: "KSh 45" },
  { item: "Sugar 2kg", time: "8 mins ago", amount: "KSh 180" },
  { item: "Milk 1L", time: "12 mins ago", amount: "KSh 85" },
]

export function MainDashboard() {
  const [currentLine, setCurrentLine] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => (prev + 1) % terminalLines.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Terminal Output */}
      <div className="glass rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-slate-400 font-mono text-sm">vendai dashboard.</span>
        </div>

        <div className="font-mono text-sm space-y-2 terminal-scroll max-h-32 overflow-y-auto">
          {terminalLines.map((line, index) => (
            <div
              key={index}
              className={`${index <= currentLine ? "opacity-100" : "opacity-30"} transition-opacity duration-500`}
            >
              {line.type === "command" ? (
                <div className="text-blue-400">{line.text}</div>
              ) : (
                <div className={line.color}>{line.text}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <div key={index} className={`glass rounded-lg p-4 border ${metric.borderColor} ${metric.bgColor}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${metric.color}`} />
                <div className="text-xs text-slate-400 font-mono">{metric.title}</div>
              </div>
              <div className={`text-2xl font-bold ${metric.color} mb-1`}>{metric.value}</div>
              <div className="text-xs text-slate-400">{metric.change}</div>
            </div>
          )
        })}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="glass rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Recent Transactions</h3>
          <div className="space-y-3">
            {recentTransactions.map((transaction, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-b-0"
              >
                <div>
                  <div className="text-sm font-medium text-slate-200">{transaction.item}</div>
                  <div className="text-xs text-slate-400 font-mono">{transaction.time}</div>
                </div>
                <div className="text-green-400 font-mono font-semibold">{transaction.amount}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="glass rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">AI Suggestions</h3>
          <div className="space-y-4">
            <div className="glass-light rounded-lg p-4 border border-green-500/30">
              <div className="text-sm font-medium text-green-400 mb-1">→ Restock Recommendation</div>
              <div className="text-xs text-slate-300 mb-2">
                15 items below minimum stock. Order suggested from Mumias Sugar (KSh 140 each)
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30 hover:bg-green-500/30 transition-colors">
                  Approve
                </button>
                <button className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded text-xs border border-slate-600/30 hover:bg-slate-600/50 transition-colors">
                  Review
                </button>
              </div>
            </div>

            <div className="glass-light rounded-lg p-4 border border-orange-500/30">
              <div className="text-sm font-medium text-orange-400 mb-1">→ Price Adjustment</div>
              <div className="text-xs text-slate-300 mb-2">Increase Coca Cola price to KSh 65 based on demand</div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded text-xs border border-orange-500/30 hover:bg-orange-500/30 transition-colors">
                  Apply
                </button>
                <button className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded text-xs border border-slate-600/30 hover:bg-slate-600/50 transition-colors">
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
