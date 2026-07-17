import { useEffect, useRef } from 'react'
import type { Conversation, Settings, ModelInfo, MessagePart } from '../../types/index'
import { MessageBubble }   from '../MessageBubble/MessageBubble'
import { InputBar }        from '../InputBar/InputBar'
import { TypingIndicator } from '../TypingIndicator/TypingIndicator'
import './ChatPanel.css'

interface Props {
  conversation: Conversation | null
  settings: Settings
  currentModelInfo?: ModelInfo | null
  isStreaming: boolean
  streamingText: string
  onSendMessage: (content: string, parts?: MessagePart[]) => void
  onStopGeneration: () => void
  onChangeModel: (modelId: string) => void
  onOpenModelBrowser: () => void
  onRegenerate: () => void
  onExport: (format: 'md' | 'json') => void
  onNewChat: () => void
  onTTS?: (text: string) => void
  onEmbedding?: (text: string) => void
}

export function ChatPanel({
  conversation,
  settings,
  currentModelInfo,
  isStreaming,
  streamingText,
  onSendMessage,
  onStopGeneration,
  onChangeModel,
  onOpenModelBrowser,
  onRegenerate,
  onExport,
  onNewChat,
  onTTS,
  onEmbedding,
}: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation?.messages, streamingText])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    atBottomRef.current = true
  }

  const userMessages = conversation?.messages.filter((m) => m.role !== 'system') ?? []

  // ── Empty state ──────────────────────────────────────
  if (!conversation) {
    return (
      <div className="chat-panel chat-empty-state" id="chat-panel">
        <div className="empty-content">
          <div className="empty-logo">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--accent)" opacity="0.9"/>
              <path d="M2 17l10 5 10-5" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="empty-title">Welcome to Vellum</h1>
          <p className="empty-subtitle">
            One API key. 600+ models. Start a conversation.
          </p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={onNewChat} id="empty-new-chat-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Chat
            </button>
            <button className="btn btn-ghost" onClick={onOpenModelBrowser} id="empty-browse-models-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              </svg>
              Browse Models
            </button>
          </div>
          <div className="empty-tips">
            <div className="empty-tip"><kbd>Ctrl</kbd><kbd>N</kbd> New chat</div>
            <div className="empty-tip"><kbd>Ctrl</kbd><kbd>K</kbd> Search</div>
            <div className="empty-tip"><kbd>Ctrl</kbd><kbd>,</kbd> Settings</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-panel" id="chat-panel">
      {/* Chat toolbar */}
      <div className="chat-toolbar">
        <div className="chat-toolbar-left">
          <span className="chat-model-label">
            {conversation.model.split('/').pop()}
          </span>
          {userMessages.length > 0 && (
            <span className="chat-msg-count">
              {userMessages.length} message{userMessages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="chat-toolbar-right">
          <button
            className="btn-icon"
            title="Export as Markdown"
            onClick={() => onExport('md')}
            id="export-md-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button
            className="btn-icon"
            title="Export as JSON"
            onClick={() => onExport('json')}
            id="export-json-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </button>
          <button
            className="btn-icon"
            title="Switch model"
            onClick={onOpenModelBrowser}
            id="chat-switch-model-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        className="chat-messages"
        ref={scrollRef}
        onScroll={handleScroll}
        id="chat-messages-list"
      >
        {userMessages.length === 0 && (
          <div className="chat-start-prompt">
            <p>Send a message to start the conversation with <strong>{conversation.model.split('/').pop()}</strong></p>
          </div>
        )}

        {userMessages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={idx === userMessages.length - 1}
            isStreaming={false}
            onRegenerate={
              msg.role === 'assistant' && idx === userMessages.length - 1 && !isStreaming
                ? onRegenerate
                : undefined
            }
            onTTS={onTTS}
          />
        ))}

        {/* Streaming placeholder */}
        {isStreaming && (
          <div className="streaming-message">
            {streamingText ? (
              <MessageBubble
                message={{
                  id: '__streaming__',
                  role: 'assistant',
                  content: streamingText,
                  timestamp: Date.now(),
                }}
                isLast
                isStreaming
              />
            ) : (
              <TypingIndicator model={conversation.model} />
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom FAB */}
      <button
        className="scroll-bottom-btn"
        onClick={scrollToBottom}
        title="Scroll to bottom"
        id="scroll-bottom-btn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Input bar */}
      <InputBar
        currentModel={conversation.model}
        currentModelInfo={currentModelInfo}
        isStreaming={isStreaming}
        sendOnEnter={settings.sendOnEnter}
        onSend={onSendMessage}
        onStop={onStopGeneration}
        onOpenModelBrowser={onOpenModelBrowser}
        apiKey={settings.apiKey}
        onEmbedding={onEmbedding}
        onTTS={onTTS}
      />
    </div>
  )
}
