import { useState, useRef, useEffect, useCallback } from 'react'
import './InputBar.css'

interface Props {
  currentModel: string
  isStreaming: boolean
  sendOnEnter: boolean
  onSend: (content: string) => void
  onStop: () => void
  onOpenModelBrowser: () => void
}

export function InputBar({ currentModel, isStreaming, sendOnEnter, onSend, onStop, onOpenModelBrowser }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [text, adjustHeight])

  // Focus after streaming ends
  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus()
  }, [isStreaming])

  const handleSend = () => {
    const content = text.trim()
    if (!content || isStreaming) return
    onSend(content)
    setText('')
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (sendOnEnter && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      } else if (!sendOnEnter && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSend()
      }
    }
  }

  const modelDisplay = currentModel.includes('/')
    ? currentModel.split('/')[1]
    : currentModel

  const charCount = text.length
  const showCount = charCount > 500

  return (
    <div className="input-bar" id="input-bar">
      <div className="input-bar-inner">
        {/* Model chip */}
        <button
          className="input-model-chip"
          onClick={onOpenModelBrowser}
          title="Switch model"
          id="input-model-chip"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          <span className="truncate">{modelDisplay}</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Text area */}
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={isStreaming ? 'Generating…' : 'Message…  (Shift+Enter for new line)'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
            id="chat-input-textarea"
            aria-label="Chat message"
          />
          {showCount && (
            <span className="char-count">{charCount.toLocaleString()}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="input-actions">
          {isStreaming ? (
            <button
              className="send-btn stop-btn"
              onClick={onStop}
              title="Stop generation"
              id="stop-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Stop
            </button>
          ) : (
            <button
              className={`send-btn ${!text.trim() ? 'disabled' : ''}`}
              onClick={handleSend}
              disabled={!text.trim()}
              title={sendOnEnter ? 'Send (Enter)' : 'Send (Ctrl+Enter)'}
              id="send-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Send
            </button>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="input-footer">
        <span className="input-hint">
          {sendOnEnter
            ? <><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</>
            : <><kbd>Ctrl+Enter</kbd> to send · <kbd>Enter</kbd> for new line</>
          }
        </span>
        {isStreaming && (
          <span className="streaming-hint">
            <span className="streaming-dot" />
            Generating…
          </span>
        )}
      </div>
    </div>
  )
}
