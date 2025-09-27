"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import styles from "@/components/ai-assistant.module.css"
import { MessageSquare, Bot, Play, Loader2, CheckCircle, AlertCircle, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface AIAssistantProps {
  isExpanded: boolean;
  onClose: () => void;
}

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  action?: {
    type: 'execute_task' | 'search_inventory' | 'create_order' | 'generate_report'
    status: 'pending' | 'running' | 'completed' | 'error'
    result?: any
  }
}

interface AgentTask {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress?: number
  result?: any
}

export function AIAssistant({ isExpanded, onClose }: AIAssistantProps) {
  const [mode, setMode] = useState<"ask" | "agent">("agent")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: '👋 VendAI Agent ready! I can help you with tasks like inventory management, creating orders, generating reports, and more. Try asking me to do something specific!',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTasks, setActiveTasks] = useState<AgentTask[]>([])
  // Agent task execution functions
  const executeTask = async (prompt: string) => {
    setIsProcessing(true)
    
    const taskId = Date.now().toString()
    const newTask: AgentTask = {
      id: taskId,
      title: `Processing: ${prompt.substring(0, 50)}...`,
      description: prompt,
      status: 'pending',
      progress: 0
    }
    
    setActiveTasks(prev => [...prev, newTask])
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Simulate task processing with intelligent responses
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'I understand! Let me work on that for you...',
      timestamp: new Date(),
      action: {
        type: 'execute_task',
        status: 'running'
      }
    }
    
    setMessages(prev => [...prev, assistantMessage])
    
    try {
      // Update task progress
      setActiveTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'running', progress: 25 } : task
      ))
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setActiveTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, progress: 75 } : task
      ))
      
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate intelligent task completion
      let taskResult = processTaskIntelligently(prompt)
      
      setActiveTasks(prev => prev.map(task => 
        task.id === taskId ? { 
          ...task, 
          status: 'completed', 
          progress: 100,
          result: taskResult
        } : task
      ))
      
      // Update assistant message with results
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id ? {
          ...msg,
          content: `✅ Task completed! ${taskResult.description}`,
          action: {
            ...msg.action!,
            status: 'completed',
            result: taskResult
          }
        } : msg
      ))
      
    } catch (error) {
      setActiveTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'error' } : task
      ))
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id ? {
          ...msg,
          content: '❌ Sorry, I encountered an error while processing that task.',
          action: {
            ...msg.action!,
            status: 'error'
          }
        } : msg
      ))
    } finally {
      setIsProcessing(false)
      // Clear completed tasks after 5 seconds
      setTimeout(() => {
        setActiveTasks(prev => prev.filter(task => task.id !== taskId))
      }, 5000)
    }
  }
  
  const processTaskIntelligently = (prompt: string): any => {
    const lowerPrompt = prompt.toLowerCase()
    
    // Inventory-related tasks
    if (lowerPrompt.includes('inventory') || lowerPrompt.includes('stock') || lowerPrompt.includes('product')) {
      if (lowerPrompt.includes('low') || lowerPrompt.includes('running out')) {
        return {
          type: 'inventory_check',
          description: 'Found 12 items with low stock levels. Updated inventory alerts.',
          data: { lowStockItems: 12, criticalItems: 3 }
        }
      } else if (lowerPrompt.includes('add') || lowerPrompt.includes('create')) {
        return {
          type: 'inventory_add',
          description: 'Successfully added new products to inventory.',
          data: { itemsAdded: Math.floor(Math.random() * 10) + 1 }
        }
      } else {
        return {
          type: 'inventory_report',
          description: 'Generated comprehensive inventory report with current stock levels.',
          data: { totalProducts: 245, inStock: 198, outOfStock: 15 }
        }
      }
    }
    
    // Sales and POS tasks
    if (lowerPrompt.includes('sale') || lowerPrompt.includes('pos') || lowerPrompt.includes('order')) {
      if (lowerPrompt.includes('report') || lowerPrompt.includes('summary')) {
        return {
          type: 'sales_report',
          description: 'Generated sales report for today. Revenue is up 15% from yesterday!',
          data: { todayRevenue: 15420, salesCount: 87, avgOrderValue: 177 }
        }
      } else if (lowerPrompt.includes('create') || lowerPrompt.includes('new')) {
        return {
          type: 'order_creation',
          description: 'Created new order template and configured POS settings.',
          data: { orderTemplate: 'created', posConfigured: true }
        }
      }
    }
    
    // Customer-related tasks
    if (lowerPrompt.includes('customer') || lowerPrompt.includes('client')) {
      return {
        type: 'customer_management',
        description: 'Updated customer database and loyalty program settings.',
        data: { customersUpdated: 45, loyaltyPointsDistributed: 2340 }
      }
    }
    
    // Analytics and reporting
    if (lowerPrompt.includes('report') || lowerPrompt.includes('analytic') || lowerPrompt.includes('performance')) {
      return {
        type: 'analytics_report',
        description: 'Generated comprehensive business analytics report with key performance metrics.',
        data: { 
          period: 'Last 7 days',
          revenue: 45620,
          growth: '+12%',
          topCategory: 'Electronics'
        }
      }
    }
    
    // Default intelligent response
    return {
      type: 'general_task',
      description: 'Task completed successfully! I\'ve processed your request and updated the system.',
      data: { 
        processed: true, 
        timestamp: new Date().toISOString(),
        confidence: '95%'
      }
    }
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return
    
    if (mode === "agent") {
      executeTask(input.trim())
    } else {
      // Regular chat mode (keep existing functionality)
      const newMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: input.trim(),
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, newMessage])
      
      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'I understand your question. Let me help you with that...',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiResponse])
      }, 1000)
    }
    
    setInput('')
  }

  if (!isExpanded) return null;

      return (
    <div 
      id="ai-assistant-panel"
      role="dialog"
      aria-label="AI Assistant Panel"
      data-expanded={isExpanded}
      className={cn(
        styles.assistantPanel,
        "border-l border-white/20 flex flex-col"
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
            onClick={() => setMessages([{
              id: '1',
              type: 'system',
              content: '👋 vendai Agent ready! I can help you with tasks like inventory management, creating orders, generating reports, and more. Try asking me to do something specific!',
              timestamp: new Date()
            }])}
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
            <Sparkles className="w-3 h-3 mr-1" />
            Agent
          </button>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Close AI Assistant"
          >
            <span className="text-lg">×</span>
          </button>
        </div>
      </div>

      {/* Active Tasks Display */}
      {activeTasks.length > 0 && (
        <div className="border-b border-white/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Active Tasks ({activeTasks.length})
          </div>
          {activeTasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/5 rounded-lg p-3 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white truncate flex-1 mr-2">
                  {task.title}
                </span>
                <div className="flex items-center gap-1">
                  {task.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                  {task.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-400" />}
                  {task.status === 'error' && <AlertCircle className="w-3 h-3 text-red-400" />}
                </div>
              </div>
              {task.progress !== undefined && (
                <div className="w-full bg-black/30 rounded-full h-1.5 mb-1">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
              <p className="text-xs text-slate-400 truncate">{task.description}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Body */}
      <>
          <div className="flex-1 overflow-hidden flex flex-col justify-end">
            <div className="flex-1 min-h-0">
              {messages.length <= 1 ? (
                <div className={styles.placeholder}>
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="mb-6"
                    >
                      {mode === "agent" ? (
                        <div className="relative">
                          <Bot className="w-16 h-16 text-purple-400" />
                          <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
                        </div>
                      ) : (
                        <MessageSquare className="w-16 h-16 text-blue-400" />
                      )}
                    </motion.div>
                    
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {mode === "agent" ? "vendai Agent" : "Ask vendai"}
                    </h3>
                    
                    <p className="text-slate-300 text-sm max-w-sm leading-relaxed">
                      {mode === "agent" 
                        ? "I'm your intelligent agent assistant. I can help you manage inventory, create orders, generate reports, and perform various POS tasks automatically!"
                        : "Ask me anything about your business, inventory, sales, or get help with POS operations."
                      }
                    </p>
                    
                    {mode === "agent" && (
                      <div className="mt-4 space-y-2 text-xs text-slate-400">
                        <p className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                          Try: "Check my inventory levels"
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Try: "Generate today's sales report"
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                          Try: "Create a new product order"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <div className="p-4 space-y-4">
                    <AnimatePresence>
                      {messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.95 }}
                          transition={{ 
                            duration: 0.3,
                            delay: index * 0.1,
                            ease: "easeOut"
                          }}
                          className={cn(
                            "flex gap-3 p-3 rounded-lg",
                            message.type === 'user' 
                              ? "bg-blue-500/20 ml-8" 
                              : message.type === 'system'
                              ? "bg-purple-500/20 border border-purple-500/30"
                              : "bg-white/5 mr-8"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {message.type === 'user' ? (
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                U
                              </div>
                            ) : message.type === 'system' ? (
                              <Sparkles className="w-6 h-6 text-purple-400" />
                            ) : (
                              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-300">
                                {message.type === 'user' ? 'You' : message.type === 'system' ? 'System' : 'VendAI Agent'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                              {message.action && (
                                <div className="flex items-center gap-1 ml-auto">
                                  {message.action.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                                  {message.action.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-400" />}
                                  {message.action.status === 'error' && <AlertCircle className="w-3 h-3 text-red-400" />}
                                </div>
                              )}
                            </div>
                            
                            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                              {message.content}
                            </p>
                            
                            {message.action?.result && message.action.status === 'completed' && (
                              <div className="mt-2 p-2 bg-black/30 rounded border border-white/10 text-xs">
                                <div className="text-slate-300 mb-1">Task Result:</div>
                                <div className="text-slate-400">
                                  Type: {message.action.result.type}<br/>
                                  {message.action.result.data && Object.entries(message.action.result.data).map(([key, value]) => (
                                    <span key={key}>{key}: {String(value)}<br/></span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3 p-3 rounded-lg bg-white/5 mr-8"
                      >
                        <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-slate-300 mb-1">VendAI Agent</div>
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <span className="animate-pulse">Processing your request...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Footer */}
          <div className="border-t border-white/10 p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 pr-12 text-white text-sm resize-none focus:outline-none focus:border-purple-400/50 focus:bg-black/50 transition-all duration-200 placeholder-slate-400"
                  placeholder={mode === "agent" 
                    ? "Tell me what task you'd like me to perform..."
                    : "Ask me anything about your business..."
                  }
                  rows={1}
                  disabled={isProcessing}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'inherit';
                    const computed = window.getComputedStyle(target);
                    const height = parseInt(computed.getPropertyValue('border-top-width'), 10)
                                 + parseInt(computed.getPropertyValue('padding-top'), 10)
                                 + target.scrollHeight
                                 + parseInt(computed.getPropertyValue('padding-bottom'), 10)
                                 + parseInt(computed.getPropertyValue('border-bottom-width'), 10);
                    target.style.height = `${Math.min(height, 120)}px`;
                  }}
                />
                
                <button
                  type="submit"
                  disabled={!input.trim() || isProcessing}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all duration-200",
                    !input.trim() || isProcessing
                      ? "text-slate-500 cursor-not-allowed"
                      : "text-white bg-purple-500 hover:bg-purple-600 shadow-lg"
                  )}
                  aria-label={mode === "agent" ? "Execute Task" : "Send Message"}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === "agent" ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              
              {mode === "agent" && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sparkles className="w-3 h-3" />
                  <span>Agent mode: I'll perform tasks automatically based on your instructions</span>
                </div>
              )}
            </form>
          </div>
        </>
    </div>
  )
}