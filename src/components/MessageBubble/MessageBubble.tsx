import { useState, useEffect, useRef } from 'react'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import type { ChatMessage, MessagePart } from '../../types/index'
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

// ── Render a single multimodal part ──────────────────
function RenderPart({ part }: { part: MessagePart }) {
  const [audioExpanded, setAudioExpanded] = useState(false)
  const [embeddingExpanded, setEmbeddingExpanded] = useState(false)
  const [imgZoom, setImgZoom] = useState(false)

  if (part.type === 'text') {
    return (
      <div
        className="message-content markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(part.text) }}
      />
    )
  }

  if (part.type === 'image_url') {
    return (
      <div className="media-part image-part">
        <img
          src={part.url}
          alt={part.fileName ?? 'Attached image'}
          className={`media-image ${imgZoom ? 'zoomed' : ''}`}
          onClick={() => setImgZoom((v) => !v)}
          title="Click to zoom"
        />
        {imgZoom && (
          <div className="media-zoom-overlay" onClick={() => setImgZoom(false)}>
            <img src={part.url} alt={part.fileName} className="media-image-zoomed" />
          </div>
        )}
        {part.fileName && (
          <div className="media-caption">{part.fileName}</div>
        )}
      </div>
    )
  }

  if (part.type === 'audio' || part.type === 'tts_audio') {
    const src = `data:${part.mimeType};base64,${part.data}`
    const label = part.type === 'tts_audio'
      ? `🔊 Text-to-Speech${part.voice ? ` · ${part.voice}` : ''}`
      : `🎵 ${part.fileName ?? 'Audio file'}`
    return (
      <div className="media-part audio-part">
        <div className="audio-header" onClick={() => setAudioExpanded((v) => !v)}>
          <span>{label}</span>
          <svg className={`chevron ${audioExpanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        {audioExpanded && (
          <audio controls className="audio-player" src={src}>
            Your browser does not support audio playback.
          </audio>
        )}
        {part.type === 'audio' && (part as { transcript?: string }).transcript && (
          <div className="audio-transcript">
            <span className="transcript-label">Transcript:</span>
            {(part as { transcript?: string }).transcript}
          </div>
        )}
      </div>
    )
  }

  if (part.type === 'video_url') {
    return (
      <div className="media-part video-part">
        <div className="video-url-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
          <span>Video URL attached</span>
          <a href={part.url} className="video-url-link" onClick={(e) => { e.preventDefault(); window.vellum.openExternal(part.url) }}>
            {part.url.length > 50 ? part.url.slice(0, 47) + '…' : part.url}
          </a>
        </div>
      </div>
    )
  }

  if (part.type === 'embedding') {
    const preview = part.vectors.slice(0, 8)
    return (
      <div className="media-part embedding-part">
        <div className="embedding-header" onClick={() => setEmbeddingExpanded((v) => !v)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          <span>Embedding · <strong>{part.dimension}</strong> dimensions · <code>{part.model}</code></span>
          <svg className={`chevron ${embeddingExpanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        {embeddingExpanded && (
          <div className="embedding-vectors">
            <div className="embedding-preview">
              [{preview.map((v, i) => (
                <span key={i} className="embedding-value">{v.toFixed(4)}{i < preview.length - 1 ? ', ' : ''}</span>
              ))}
              {part.vectors.length > 8 && <span className="embedding-more">… +{part.vectors.length - 8} more</span>}]
            </div>
            <div className="embedding-stats">
              Min: {Math.min(...part.vectors).toFixed(4)} · Max: {Math.max(...part.vectors).toFixed(4)} · Dims: {part.dimension}
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

interface Props {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  onRegenerate?: () => void
  onTTS?: (text: string) => void
}

export function MessageBubble({ message, isLast, isStreaming, onRegenerate, onTTS }: Props) {
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isUser      = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Has multimodal parts?
  const hasParts = message.parts && message.parts.length > 0
  // Text content for copy & TTS
  const textContent = hasParts
    ? (message.parts ?? []).filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text').map((p) => p.text).join('\n')
    : message.content

  // Attach copy buttons to code blocks
  useEffect(() => {
    if (!contentRef.current) return
    const pres = contentRef.current.querySelectorAll('pre')
    pres.forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return
      const code = pre.querySelector('code')
      const lang = code?.className?.replace('hljs language-', '') ?? 'code'

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
  }, [message.content, message.parts])

  const copyMessage = async () => {
    await navigator.clipboard.writeText(textContent)
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
        {/* Content — multimodal or plain text */}
        {hasParts ? (
          <div className="message-parts">
            {(message.parts ?? []).map((part, idx) => (
              <RenderPart key={idx} part={part} />
            ))}
          </div>
        ) : isUser ? (
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

          <div className="message-actions">
            {/* Copy */}
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

            {/* TTS button — only for text messages */}
            {textContent && onTTS && !isStreaming && (
              <button
                className="msg-action-btn tts-btn"
                onClick={() => onTTS(textContent)}
                title="Listen to this message (Text-to-Speech)"
                id={`tts-msg-${message.id}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </button>
            )}

            {/* Regenerate */}
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
