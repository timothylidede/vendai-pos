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
        "border-l border-white/20 flex flex-col",
        isMinimized && styles.minimized
      )}
    >
      {/* Header */}
      <div
        className={cn(
          styles.header,
          "flex items-center justify-between border-b border-white/10 px-4"
        )}
      >
        {/* Left icons */}
        <div className="flex items-center gap-2">
          <button
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="New Chat"
            onClick={() => setChatHistory([])}
          >
            <span className="text-lg">+</span>
          </button>
          <button
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Chat History"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Center mode toggle */}
        <div className="flex bg-black/20 rounded-lg p-[2px]">
          <button
            className={cn(
              "px-2 py-0.5 rounded-md text-xs font-medium transition-colors",
              mode === "ask" ? "bg-white/20 text-white backdrop-blur-sm" : "text-slate-300 hover:text-white"
            )}
            onClick={() => setMode("ask")}
          >
            Ask
          </button>
          <button
            className={cn(
              "px-2 py-0.5 rounded-md text-xs font-medium transition-colors",
              mode === "agent" ? "bg-white/20 text-white backdrop-blur-sm" : "text-slate-300 hover:text-white"
            )}
            onClick={() => setMode("agent")}
          >
            Agent
          </button>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <button
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Minimize"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <span className="text-lg">−</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Close AI Assistant"
          >
            <span className="text-lg">×</span>
          </button>
        </div>
      </div>

            {/* Body */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-hidden flex flex-col justify-end">
            <div className="flex-1 min-h-0">
              {chatHistory.length === 0 ? (
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>💬</div>
                  <p className="text-base">How can I help?</p>
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-4">
                  {/* Chat messages will go here */}
                </div>
              )}
            </div>
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
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            {/* Space for VendAI Button */}
            <div className="h-3" /> {/* Reduced space for VendAI button */}
          </div>
        </>
      )}
    </div>
  )
}