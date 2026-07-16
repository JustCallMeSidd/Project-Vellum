import { useState, useEffect, useRef } from 'react'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import type { ChatMessage } from '../../types/index'
import './MessageBubble.css'

// ── Markdown renderer with syntax highlighting ────────
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  })
)

marked.use({ breaks: true, gfm: true })

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string
  } catch {
    return content
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  onRegenerate?: () => void
}

export function MessageBubble({ message, isLast, isStreaming, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isUser      = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Attach copy buttons to all code blocks after render
  useEffect(() => {
    if (!contentRef.current) return
    const pres = contentRef.current.querySelectorAll('pre')
    pres.forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return // Already attached

      const code = pre.querySelector('code')
      const lang = code?.className?.replace('hljs language-', '') ?? 'code'

      // Header bar
      const header = document.createElement('div')
      header.className = 'code-block-header'

      const langSpan = document.createElement('span')
      langSpan.textContent = lang
      header.appendChild(langSpan)

      const btn = document.createElement('button')
      btn.className = 'code-copy-btn'
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`
      btn.onclick = async () => {
        await navigator.clipboard.writeText(code?.textContent ?? '')
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Copied!`
        setTimeout(() => {
          btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`
        }, 2000)
      }
      header.appendChild(btn)
      pre.insertBefore(header, pre.firstChild)
    })
  }, [message.content])

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`message-row ${isUser ? 'user' : 'assistant'} ${isLast ? 'last' : ''}`}
      id={`message-${message.id}`}
    >
      {/* Avatar */}
      {isAssistant && (
        <div className="message-avatar assistant-avatar" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--accent)" />
          </svg>
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'} ${message.error ? 'error-bubble' : ''}`}>
        {/* Content */}
        {isUser ? (
          <div className="message-content user-content">{message.content}</div>
        ) : (
          <div
            ref={contentRef}
            className={`message-content markdown ${isStreaming && isLast ? 'streaming-cursor' : ''}`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}

        {/* Message footer */}
        <div className="message-footer">
          <span className="message-time">{formatTime(message.timestamp)}</span>
          {message.model && isAssistant && (
            <span className="message-model">{message.model.split('/').pop()}</span>
          )}

          {/* Actions */}
          <div className="message-actions">
            <button
              className="msg-action-btn"
              onClick={copyMessage}
              title={copied ? 'Copied!' : 'Copy message'}
              id={`copy-msg-${message.id}`}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
            {onRegenerate && (
              <button
                className="msg-action-btn"
                onClick={onRegenerate}
                title="Regenerate response"
                id={`regen-msg-${message.id}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="message-avatar user-avatar" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      )}
    </div>
  )
}
