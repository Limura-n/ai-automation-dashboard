'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Terminal, X } from 'lucide-react'
import { getModelProviderKey } from '@/lib/models'

interface CmdMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ─── Stable ThinkingDots (module-level — NOT inside component) ───
// Defined here so parent re-renders (from polling hooks every 5-15s)
// don't unmount/remount it, resetting the dot animation state.
function ThinkingDots() {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 400)
    return () => clearInterval(interval)
  }, [])
  return (
    <span className="text-emerald-400/90 text-sm font-semibold tracking-wider animate-pulse">
      Thinking{dots}
    </span>
  )
}

// ─── Memoized Message Item ──────────────────────────────────
const MessageItem = memo(function MessageItem({ msg, isLatestUser }: { msg: CmdMessage; isLatestUser: boolean }) {
  return (
    <div
      className={`text-xs leading-relaxed ${
        isLatestUser && msg.role === 'user'
          ? 'animate-[messageSent_0.6s_ease-out]'
          : ''
      }`}
    >
      {msg.role === 'user' ? (
        <div>
          <span className="text-emerald-500">$ </span>
          <span className="text-slate-200">{msg.content}</span>
          <span className="inline-block ml-1.5 text-[9px] text-emerald-500/60">
            ✓
          </span>
        </div>
      ) : (
        <div className="pl-4 border-l border-emerald-500/20 ml-1">
          <span className="text-slate-300 whitespace-pre-wrap">{msg.content}</span>
        </div>
      )}
    </div>
  )
})

export function LimuraTerminal({ open, onOpenChange, initialMessage, visionStage, projectId }: { open: boolean; onOpenChange: (v: boolean) => void; initialMessage?: string | null; visionStage?: string | null; projectId?: string | null }) {
  const [messages, setMessages] = useState<CmdMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  // Which model the user chose in the Models Panel
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<string>('hermes-gateway')
  const [lastSentId, setLastSentId] = useState<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const initialProcessedRef = useRef(false)

  // When initialMessage is provided, add it as the first assistant message
  useEffect(() => {
    if (!open || !initialMessage || initialProcessedRef.current) return
    initialProcessedRef.current = true
    setMessages([{ id: `a-initial-${Date.now()}`, role: 'assistant', content: initialMessage }])
  }, [open, initialMessage])

  // Reset processed flag when initialMessage changes
  useEffect(() => {
    initialProcessedRef.current = false
  }, [initialMessage])

  const handleApprovePlan = useCallback(async () => {
    // Find the vision plan ID by checking messages
    if (!messages.length) return
    try {
      const statusRes = await fetch('/api/vision')
      const status = await statusRes.json()
      if (status.plan?.id) {
        await fetch('/api/vision', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: status.plan.id, status: 'approved' }),
        })
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: '✅ Plan approved! Work will begin immediately. I\'ll keep you updated on progress.',
        }])
        // Trigger orchestrator immediately — don't wait for next cron cycle
        fetch('/api/orchestrator/trigger', { method: 'POST' }).catch(() => {})
      }
    } catch {}
  }, [messages])

  const handleDismissPlan = useCallback(() => {
    setMessages(prev => [...prev, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '⏸️ No problem! The plan is saved — you can review it anytime. Just type "show me the vision plan" to bring it back.',
    }])
  }, [])

  // Fetch profile when dialog opens to get the user's chosen model
  useEffect(() => {
    if (!open) return
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        const model = data?.profile?.model
        if (model) {
          setActiveModel(model)
          const providerKey = getModelProviderKey(model)
          if (providerKey) setActiveProvider(providerKey)
        }
      })
      .catch(() => {})

    // Check for pending agent requests + prerequisites and notify in chat
    Promise.all([
      fetch('/api/agent-requests').then(r => r.json()).catch(() => ({ requests: [] })),
      projectId ? fetch(`/api/prerequisites?projectId=${projectId}`).then(r => r.json()).catch(() => ({ prerequisites: [] })) : Promise.resolve({ prerequisites: [] }),
    ]).then(([agentData, prereqData]) => {
      const agentPending = (agentData.requests || []).filter((r: any) => r.status === 'pending')
      const prereqPending = (prereqData.prerequisites || []).filter((r: any) => r.status === 'pending' && r.required)
      const allNeeds = [
        ...agentPending.map((r: any) => ({ label: r.label, required: r.required, source: 'agent' })),
        ...prereqPending.map((r: any) => ({ label: r.label, required: r.required, source: 'prerequisite' })),
      ]
      if (allNeeds.length > 0 && messages.length === 0 && !initialMessage) {
        const reqList = allNeeds.map((r: any) => `• ${r.label} ${r.required ? '(Required)' : ''}`).join('\n')
        setMessages([{
          id: `a-notify-${Date.now()}`,
          role: 'assistant',
          content: `📋 **Agent Needs Your Input**\n\nThe system needs some information from you to proceed:\n\n${reqList}\n\nGo to **Vision Plan → Prerequisite Checklist** to fill these in.`,
        }])
      }
    })
  }, [open])

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [messages, isStreaming, streamingContent])

  // Focus input when opened, or after streaming ends (so input is no longer disabled)
  useEffect(() => {
    if (open && !isStreaming && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open, isStreaming])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    const userMsg: CmdMessage = { id: `u-${Date.now()}`, role: 'user', content: content.trim() }
    const currentMessages = messagesRef.current

    // Track the latest user message ID for sent animation
    setLastSentId(userMsg.id)

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreamingContent('')
    setIsStreaming(true)

    try {
      const allMessages = [...currentMessages, userMsg]
      const model = activeModel || 'hermes-agent'
      const provider = activeProvider

      // Check if this is modification feedback (last assistant message asked about changes)
      const isModificationFeedback = currentMessages.length > 0 &&
        currentMessages[currentMessages.length - 1]?.content?.includes("what you'd like to change")

      // If modification feedback, regenerate plan in background
      if (isModificationFeedback) {
        fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modificationFeedback: content.trim() }),
        }).then(r => r.json()).then(data => {
          if (data.success && data.plan) {
            setMessages(prev => [...prev, {
              id: `a-plan-${Date.now()}`,
              role: 'assistant',
              content: `🔄 **Updated Plan Based on Your Feedback**\n\n---\n\n${data.plan.content}`,
            }])
          }
        }).catch(() => {})
        // Still send to chat for conversational response
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          provider,
          model,
          source: 'dashboard', // Tell Limura this is coming from the dashboard
        }),
      })

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`
        let errorCode = ''
        try {
          const errBody = await res.json()
          if (errBody.error) errorMsg = errBody.error
          if (errBody.code) errorCode = errBody.code
        } catch {}

        if (errorCode === 'BACKEND_OFFLINE') {
          setMessages(prev => [...prev, {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: [
              '🤖  AI Chat is Sleeping',
              '━━━━━━━━━━━━━━━━━━━━━━━━',
              '',
              'The AI assistant isn\'t connected yet.',
              'That\'s totally fine — it just needs a',
              'quick setup to wake it up!',
              '',
              '📋  Here\'s what to do:',
              '',
              'Step 1 — Open Terminal',
              '  Search for "Terminal" on your computer',
              '  and open it.',
              '',
              'Step 2 — Install the AI Brain',
              '  Copy and paste these lines one at a time',
              '  (press Enter after each):',
              '',
              '    git clone https://github.com',
              '      /NazmulsTech/HermesAgent.git',
              '    cd HermesAgent',
              '    pip install -e .',
              '',
              'Step 3 — Go to Your Dashboard Folder',
              '  If your Dashboard is on the Desktop, type:',
              '',
              '    cd',
              '    cd Desktop/AdobeStockMissionControl',
              '',
              '  (If it\'s somewhere else, open a new terminal',
              '   in that folder instead)',
              '',
              'Step 4 — Run the Setup',
              '  Now type this:',
              '',
              '    bash setup.sh',
              '',
              '  (This sets up everything for you)',
              '',
              'Step 5 — Start Chatting!',
              '  After setup finishes, type:',
              '',
              '    hermes gateway',
              '',
              '  Then come back here and say hi! 🎉',
              '',
              'Need help? Ask your administrator',
              'or the person who gave you this dashboard.',
            ].join('\n'),
          }])
          setIsStreaming(false)
          return
        }

        throw new Error(errorMsg)
      }
      if (!res.body) throw new Error('Empty response')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setStreamingContent(full)
      }

      // Streaming done — commit to messages in one shot
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: full }])
      setStreamingContent('')
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `[ERROR] ${err?.message || 'Connection failed'}`,
      }])
    } finally {
      setIsStreaming(false)
      // Clear the sent highlight after a short delay
      setTimeout(() => setLastSentId(null), 2000)
    }
  }, [isStreaming, activeModel, activeProvider])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!open) return null

  return (
    <div className="fixed bottom-6 right-6 w-[500px] h-[500px] z-50 rounded-xl overflow-hidden border border-emerald-500/30 shadow-2xl shadow-black/60 flex flex-col font-mono">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-emerald-500/20 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-xs text-emerald-400 font-semibold tracking-wide">limura@agent:~$</span>
            <span className="text-[10px] text-slate-500 ml-2">— you&apos;re talking to Limura</span>
            {activeModel && (
              <span className="text-[10px] text-emerald-600 ml-2">({activeModel})</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Persistent streaming indicator — ALWAYS visible during streaming */}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline font-semibold tracking-wider">Responding</span>
            </span>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-white/5 text-slate-600 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Vision processing status bar */}
      {visionStage && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500/5 border-b border-cyan-500/10 shrink-0">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] text-cyan-300 font-medium">{visionStage}</span>
        </div>
      )}

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 bg-[#0d0d0d] custom-scrollbar"
        style={{ background: '#0d0d0d', scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a transparent' }}
      >
        {messages.length === 0 && !streamingContent ? (
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="text-emerald-500/50">┌─────────────────────────────────────────────┐</span><br />
            <span className="text-emerald-500/50">│</span><span className="text-slate-600">  Limura Terminal v2.0                        </span><span className="text-emerald-500/50">│</span><br />
            <span className="text-emerald-500/50">│</span><span className="text-slate-600">                                               </span><span className="text-emerald-500/50">│</span><br />
            <span className="text-emerald-500/50">│</span><span className="text-slate-600">  You&apos;re talking to Limura — the same AI    </span><span className="text-emerald-500/50">│</span><br />
            <span className="text-emerald-500/50">│</span><span className="text-slate-600">  that controls the entire dashboard.          </span><span className="text-emerald-500/50">│</span><br />
            <span className="text-emerald-500/50">│</span><span className="text-slate-600">                                               </span><span className="text-emerald-500/50">│</span><br />
            {activeModel && (
              <>
                <span className="text-emerald-500/50">│</span><span className="text-emerald-700">  Model: {activeModel}                         </span><span className="text-emerald-500/50">│</span><br />
                <span className="text-emerald-500/50">│</span><span className="text-slate-600">                                               </span><span className="text-emerald-500/50">│</span><br />
              </>
            )}
            <span className="text-emerald-500/50">│</span><span className="text-slate-600">  Type a message to begin                      </span><span className="text-emerald-500/50">│</span><br />
            <span className="text-emerald-500/50">└─────────────────────────────────────────────┘</span><br />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <MessageItem
                key={msg.id}
                msg={msg}
                isLatestUser={msg.id === lastSentId}
              />
            ))}
            {/* Streaming indicator area */}
            {isStreaming && (
              <div className="pl-4 border-l border-emerald-500/20 ml-1">
                {streamingContent ? (
                  <>
                    <span className="text-slate-300 whitespace-pre-wrap">{streamingContent}</span>
                    <span className="text-emerald-400 text-xs animate-pulse ml-0.5">▊</span>
                  </>
                ) : (
                  <div className="flex items-center gap-3 py-2">
                    {/* Large pulsing dot */}
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <ThinkingDots />
                    {/* Subtle "waiting for response" hint */}
                    <span className="text-[9px] text-slate-600 ml-1 hidden sm:inline">
                      · waiting for response
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Action buttons for vision plan */}
        {initialMessage && messages.length === 1 && messages[0]?.id?.startsWith('a-initial') && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-emerald-500/10 bg-white/[0.02]">
            <button
              onClick={handleApprovePlan}
              className="flex-1 text-[10px] py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-medium"
            >
              Approve ✅
            </button>
            <button
              onClick={async () => {
                // Ask user for their feedback inline
                setMessages(prev => [...prev, {
                  id: `u-${Date.now()}`,
                  role: 'user',
                  content: "I'd like to modify the plan.",
                }])
                // Remove action buttons
                setMessages(prev => prev.filter(m => !m.id.startsWith('a-initial')))
                // Show thinking state
                setIsStreaming(true)
                setStreamingContent('')
                // Ask what they want to change
                setTimeout(() => {
                  setMessages(prev => [...prev, {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    content: "Sure! Tell me what you'd like to change about the plan. For example:\n• Focus more on ecommerce\n• Change the priorities\n• Add different missions\n• Adjust the timeline\n\nType your feedback and I'll regenerate the plan based on it.",
                  }])
                  setIsStreaming(false)
                  inputRef.current?.focus()
                }, 500)
              }}
              className="flex-1 text-[10px] py-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors font-medium"
            >
              Modify ✏️
            </button>
            <button
              onClick={handleDismissPlan}
              className="flex-1 text-[10px] py-1.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20 transition-colors font-medium"
            >
              Later ⏸️
            </button>
          </div>
        )}
      </div>

      {/* Input line */}
      <div className="flex items-center px-3 py-2.5 bg-[#0a0a0a] border-t border-emerald-500/20 shrink-0">
        <span className={`text-xs mr-2 shrink-0 font-semibold ${isStreaming ? 'text-emerald-500 animate-pulse' : 'text-emerald-500'}`}>$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Limura is responding...' : 'type your message...'}
          className={`flex-1 bg-transparent border-none outline-none text-xs font-mono transition-all duration-300 ${
            isStreaming
              ? 'text-slate-500 placeholder:text-slate-800 cursor-not-allowed opacity-50'
              : 'text-slate-200 placeholder:text-slate-700'
          }`}
          spellCheck={false}
          autoComplete="off"
        />
        {/* Input-line streaming indicators */}
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline">busy</span>
          </span>
        )}
      </div>
    </div>
  )
}
