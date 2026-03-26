import { useState, useRef, useEffect } from 'react'
import { MarketMap } from '../types/marketMap'
import { sendChatMessage, ChatMessage } from '../lib/chatApi'

interface Props {
  map: MarketMap
  onClose: () => void
  initialQuestion?: string
}

const SUGGESTED = [
  'Which companies are the most promising investments?',
  'What are the key risks in this market?',
  'Which company has the strongest moat?',
  'Compare the early-stage players',
]

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-lg text-xs font-mono leading-relaxed ${
          isUser
            ? 'bg-terrain-gold text-terrain-bg'
            : 'bg-terrain-surface border border-terrain-border text-terrain-text'
        }`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function MapChat({ map, onClose, initialQuestion }: Props) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const initialSentRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-send initial question once on mount
  useEffect(() => {
    if (initialQuestion && !initialSentRef.current) {
      initialSentRef.current = true
      handleSend(initialQuestion)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  async function handleSend(text?: string) {
    const content = (text ?? input).trim()
    if (!content || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setIsLoading(true)

    try {
      const reply = await sendChatMessage(map, next)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex flex-col w-full max-w-md bg-terrain-bg border-l border-terrain-border shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-terrain-border shrink-0">
        <div>
          <div className="font-display text-sm font-semibold text-terrain-text">AI Guide</div>
          <div className="text-terrain-muted text-[10px] font-mono mt-0.5">{map.sector}</div>
        </div>
        <button
          onClick={onClose}
          className="text-terrain-muted hover:text-terrain-text text-2xl leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 && !isLoading && (
          <div className="space-y-3">
            <p className="text-terrain-muted text-xs font-mono mb-5 leading-relaxed">
              Ask me anything about the companies in this map — investment potential, competitive dynamics, risks, or comparisons.
            </p>
            {SUGGESTED.map(q => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="w-full text-left px-4 py-3 bg-terrain-surface border border-terrain-border rounded-lg text-xs font-mono text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-terrain-surface border border-terrain-border px-4 py-3 rounded-lg">
              <span className="text-terrain-muted text-xs font-mono animate-pulse">Analyzing…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-terrain-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any company…"
            rows={2}
            className="flex-1 bg-terrain-surface border border-terrain-border rounded px-3 py-2.5 text-terrain-text text-xs font-mono resize-none focus:outline-none focus:border-terrain-gold transition-colors placeholder-terrain-muted"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-terrain-gold text-terrain-bg text-xs font-bold font-mono rounded hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-terrain-muted text-[10px] font-mono mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
