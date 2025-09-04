"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import styles from "@/components/ai-assistant.module.css"

interface AIAssistantProps {
  isExpanded: boolean;
  onClose: () => void;
}

export function AIAssistant({ isExpanded, onClose }: AIAssistantProps) {
  const [mode, setMode] = useState<"ask" | "agent">("ask")
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isExpanded) return null;

  return (
    <div 
      id="ai-assistant-panel"
      role="dialog"
      aria-label="AI Assistant Panel"
      data-expanded={isExpanded}
      className={cn(
        styles.assistantPanel,
        "border-l border-slate-700/50 flex flex-col",
        isMinimized && styles.minimized
      )}
    >
      {/* Header */}
      <div
        className={cn(
          styles.header,
          "flex items-center justify-between border-b border-slate-700/50 px-6"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200">Agent</span>
          <button
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="New Chat"
            onClick={() => setChatHistory([])}
          >
            <span className="text-xl">+</span>
          </button>
          <button
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Chat History"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800/50 rounded-lg p-0.5 mr-2">
            <button
              className={cn(
                "px-3 py-1 rounded-md text-sm transition-colors",
                mode === "ask" ? "bg-slate-700 text-slate-200" : "text-slate-400 hover:text-slate-300"
              )}
              onClick={() => setMode("ask")}
            >
              Ask
            </button>
            <button
              className={cn(
                "px-3 py-1 rounded-md text-sm transition-colors",
                mode === "agent" ? "bg-slate-700 text-slate-200" : "text-slate-400 hover:text-slate-300"
              )}
              onClick={() => setMode("agent")}
            >
              Agent
            </button>
          </div>
          <button
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Minimize"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <span className="text-xl">−</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close AI Assistant"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-hidden flex flex-col">
            {chatHistory.length === 0 ? (
              <div className={styles.placeholder}>
                <div className={styles.placeholderIcon}>💬</div>
                <p className="text-lg">Ask about your shop</p>
                <p className="text-sm opacity-75">I can help you manage your business efficiently</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                {/* Chat messages will go here */}
              </div>
            )}
          </div>

          {/* Chat Footer */}
          <div className={styles.chatFooter}>
            <div className={styles.chatInput}>
              <textarea
                className={styles.chatTextarea}
                placeholder="Type your message..."
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'inherit';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              <button
                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            {/* Space for VendAI Button */}
            <div className="h-10" /> {/* Placeholder space for VendAI button */}
          </div>
        </>
      )}
    </div>
  )
}
