"use client"

import { useState } from "react"
import { Bell, AlertCircle, CheckCircle, Info } from "lucide-react"

const notifications = [
  {
    id: 1,
    type: "success",
    title: "Order Completed",
    message: "Sugar 2kg restocked successfully",
    time: "2 mins ago",
    icon: CheckCircle,
    color: "text-green-400",
  },
  {
    id: 2,
    type: "warning",
    title: "Low Stock Alert",
    message: "Bread White below minimum level",
    time: "5 mins ago",
    icon: AlertCircle,
    color: "text-orange-400",
  },
  {
    id: 3,
    type: "info",
    title: "AI Suggestion",
    message: "Price optimization available",
    time: "10 mins ago",
    icon: Info,
    color: "text-blue-400",
  },
]

export function NotificationDots() {
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
      >
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
        </div>
        <Bell className="w-4 h-4 text-slate-400" />
        <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {notifications.length}
        </span>
      </button>

      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-80 glass rounded-lg border border-slate-700/50 shadow-xl z-50">
          <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
          </div>

          <div className="max-h-64 overflow-y-auto terminal-scroll">
            {notifications.map((notification) => {
              const Icon = notification.icon
              return (
                <div
                  key={notification.id}
                  className="p-4 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-4 h-4 mt-0.5 ${notification.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 mb-1">{notification.title}</div>
                      <div className="text-xs text-slate-400 mb-1">{notification.message}</div>
                      <div className="text-xs text-slate-500 font-mono">{notification.time}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 border-t border-slate-700/50">
            <button className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
