import { useState, useRef, useEffect, useCallback } from 'react'
import type { ModelInfo, MessagePart } from '../../types/index'
import './InputBar.css'

interface AttachedFile {
  type: 'image' | 'audio' | 'video_url'
  url?: string
  data?: string
  mimeType?: string
  fileName?: string
  preview?: string
}

interface Props {
  currentModel: string
  currentModelInfo?: ModelInfo | null
  isStreaming: boolean
  sendOnEnter: boolean
  onSend: (content: string, parts?: MessagePart[]) => void
  onStop: () => void
  onOpenModelBrowser: () => void
  apiKey: string
  onEmbedding?: (text: string) => void
  onTTS?: (text: string) => void
}

// ── Which input modalities does this model support? ───────
function modelSupports(modelInfo: ModelInfo | null | undefined, type: 'image' | 'audio' | 'video'): boolean {
  if (!modelInfo) return false
  const mods = modelInfo.architecture?.input_modalities ?? []
  return mods.some((m) =>
    m.toLowerCase().includes(type === 'video' ? 'video' : type === 'image' ? 'image' : 'audio')
  )
}

// ── Mode: normal chat or a special mode ───────────────────
type InputMode = 'chat' | 'embed' | 'tts'

const MODE_LABELS: Record<InputMode, { label: string; placeholder: string; color: string }> = {
  chat:  { label: 'Chat',      placeholder: 'Message… (Shift+Enter for new line)',   color: '' },
  embed: { label: 'Embed',     placeholder: 'Enter text to generate an embedding…',  color: 'var(--accent)' },
  tts:   { label: 'Speak',     placeholder: 'Enter text to convert to speech…',      color: '#a78bfa' },
}

export function InputBar({
  currentModel, currentModelInfo, isStreaming, sendOnEnter,
  onSend, onStop, onOpenModelBrowser, apiKey,
  onEmbedding, onTTS,
}: Props) {
  const [text, setText]                     = useState('')
  const [attached, setAttached]             = useState<AttachedFile[]>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [videoUrlInput, setVideoUrlInput]   = useState('')
  const [showVideoInput, setShowVideoInput] = useState(false)
  const [capabilityWarning, setCapabilityWarning] = useState<string | null>(null)
  const [mode, setMode]                     = useState<InputMode>('chat')

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => { adjustHeight() }, [text, adjustHeight])
  useEffect(() => { if (!isStreaming) textareaRef.current?.focus() }, [isStreaming])

  // Close attach menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Auto-dismiss capability warning
  useEffect(() => {
    if (!capabilityWarning) return
    const t = setTimeout(() => setCapabilityWarning(null), 6000)
    return () => clearTimeout(t)
  }, [capabilityWarning])

  // ── Image attachment ──────────────────────────────────
  const handleAttachImage = async () => {
    setShowAttachMenu(false)
    if (!modelSupports(currentModelInfo, 'image')) {
      setCapabilityWarning(
        `⚠️ "${currentModel.split('/')[1] ?? currentModel}" is a text-only model and cannot process images.\n` +
        `Switch to a vision model like GPT-4o, Claude 3.5 Sonnet, or Gemini 2.0 Flash to use image input.`
      )
      return
    }
    const result = await window.vellum.pickFile({ accept: 'image', title: 'Select Image' })
    if (!result) return
    const fileData = await window.vellum.readFileAsBase64(result.filePath)
    const dataUrl = `data:${fileData.mimeType};base64,${fileData.data}`
    setAttached((prev) => [...prev, {
      type: 'image',
      url: dataUrl,
      data: fileData.data,
      mimeType: fileData.mimeType,
      fileName: fileData.fileName,
      preview: dataUrl,
    }])
  }

  // ── Audio attachment (always allowed — transcribed before sending) ──
  const handleAttachAudio = async () => {
    setShowAttachMenu(false)
    const result = await window.vellum.pickFile({ accept: 'audio', title: 'Select Audio File' })
    if (!result) return
    const fileData = await window.vellum.readFileAsBase64(result.filePath)
    setAttached((prev) => [...prev, {
      type: 'audio',
      data: fileData.data,
      mimeType: fileData.mimeType,
      fileName: fileData.fileName,
    }])
    setCapabilityWarning(
      `ℹ️ Audio will be transcribed using Whisper and the transcript will be sent to "${currentModel.split('/')[1] ?? currentModel}". ` +
      `All text models can respond to transcriptions.`
    )
  }

  // ── Video URL attachment ───────────────────────────────
  const handleAddVideoUrl = () => {
    const url = videoUrlInput.trim()
    if (!url) return
    // Warn but still allow — let the API respond with its own error if model doesn't support it
    if (!modelSupports(currentModelInfo, 'video')) {
      setCapabilityWarning(
        `⚠️ "${currentModel.split('/')[1] ?? currentModel}" may not support video input. ` +
        `Gemini 2.0 Flash is the recommended model for video URLs. ` +
        `The message will still be sent — the model will tell you if it cannot process the video.`
      )
    }
    setAttached((prev) => [...prev, { type: 'video_url', url, fileName: url }])
    setVideoUrlInput('')
    setShowVideoInput(false)
    setShowAttachMenu(false)
  }

  // ── Switch to Embedding mode ───────────────────────────
  const handleActivateEmbed = () => {
    setShowAttachMenu(false)
    setMode('embed')
    setText('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // ── Switch to TTS mode ────────────────────────────────
  const handleActivateTTS = () => {
    setShowAttachMenu(false)
    setMode('tts')
    setText('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const removeAttachment = (idx: number) => {
    setAttached((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Send / action based on current mode ───────────────
  const handleSend = () => {
    const content = text.trim()

    if (mode === 'embed') {
      if (!content || isStreaming) return
      onEmbedding?.(content)
      setText('')
      setMode('chat')
      return
    }

    if (mode === 'tts') {
      if (!content || isStreaming) return
      onTTS?.(content)
      setText('')
      setMode('chat')
      return
    }

    // Normal chat
    if ((!content && attached.length === 0) || isStreaming) return

    const parts: MessagePart[] = []
    for (const file of attached) {
      if (file.type === 'image' && file.url) {
        parts.push({ type: 'image_url', url: file.url, fileName: file.fileName, mimeType: file.mimeType })
      } else if (file.type === 'audio' && file.data) {
        parts.push({ type: 'audio', data: file.data, mimeType: file.mimeType!, fileName: file.fileName })
      } else if (file.type === 'video_url' && file.url) {
        parts.push({ type: 'video_url', url: file.url })
      }
    }
    if (content) {
      parts.push({ type: 'text', text: content })
    }

    onSend(content, parts.length > 0 ? parts : undefined)
    setText('')
    setAttached([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && mode !== 'chat') {
      setMode('chat')
      setText('')
      return
    }
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

  const modelDisplay = currentModel.includes('/') ? currentModel.split('/')[1] : currentModel
  const charCount = text.length
  const canSend = !isStreaming && (text.trim().length > 0 || attached.length > 0)
  const modeInfo = MODE_LABELS[mode]

  // ── Modality support badges ───────────────────────────
  const supportsImage = modelSupports(currentModelInfo, 'image')
  const supportsAudio = modelSupports(currentModelInfo, 'audio')
  const supportsVideo = modelSupports(currentModelInfo, 'video')

  return (
    <div className="input-bar" id="input-bar">

      {/* Mode banner */}
      {mode !== 'chat' && (
        <div className={`mode-banner mode-${mode}`} id={`mode-banner-${mode}`}>
          <span>
            {mode === 'embed' && '🔢 Embedding Mode — type text and press Send to generate a vector embedding'}
            {mode === 'tts'   && '🔊 Speech Mode — type text and press Send to convert it to audio'}
          </span>
          <button className="mode-cancel-btn" onClick={() => { setMode('chat'); setText('') }}>
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Capability warning */}
      {capabilityWarning && (
        <div className="capability-warning" id="capability-warning">
          <span style={{ whiteSpace: 'pre-line' }}>{capabilityWarning}</span>
          <button onClick={() => setCapabilityWarning(null)} className="cap-warn-close">✕</button>
        </div>
      )}

      {/* Attachment previews */}
      {attached.length > 0 && (
        <div className="attach-previews" id="attach-previews">
          {attached.map((file, idx) => (
            <div key={idx} className="attach-chip" id={`attach-chip-${idx}`}>
              {file.type === 'image' && file.preview && (
                <img src={file.preview} alt={file.fileName} className="attach-thumb" />
              )}
              {file.type === 'audio' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              )}
              {file.type === 'video_url' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              )}
              <span className="attach-chip-name">
                {file.type === 'video_url' ? 'Video URL' : file.fileName}
              </span>
              <button
                className="attach-chip-remove"
                onClick={() => removeAttachment(idx)}
                title="Remove"
                id={`remove-attachment-${idx}`}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="input-bar-inner" style={mode !== 'chat' ? { borderColor: modeInfo.color, boxShadow: `0 0 0 2px ${modeInfo.color}22` } : {}}>

        {/* Attach / Mode menu */}
        {mode === 'chat' && (
          <div className="attach-menu-wrap" ref={attachMenuRef}>
            <button
              className={`attach-btn ${showAttachMenu ? 'active' : ''}`}
              onClick={() => { setShowAttachMenu((v) => !v); setShowVideoInput(false) }}
              title="Attach file or choose input mode"
              id="attach-btn"
              disabled={isStreaming}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {showAttachMenu && (
              <div className="attach-menu" id="attach-menu">

                {/* ── Section: File Attachments ── */}
                <div className="attach-menu-section-label">File Inputs</div>

                {/* Image */}
                <button className="attach-menu-item" onClick={handleAttachImage} id="attach-image-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>Image</span>
                  {supportsImage
                    ? <span className="attach-support-badge supported">✓ Supported</span>
                    : <span className="attach-unsupported-badge">Text model only</span>
                  }
                </button>

                {/* Audio */}
                <button className="attach-menu-item" onClick={handleAttachAudio} id="attach-audio-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                  <span>Audio <span style={{fontSize:'10px', opacity:0.6}}>(auto-transcribed)</span></span>
                  <span className="attach-support-badge supported">✓ All models</span>
                </button>

                {/* Video URL */}
                <button
                  className="attach-menu-item"
                  onClick={() => setShowVideoInput((v) => !v)}
                  id="attach-video-btn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                  <span>Video URL</span>
                  {supportsVideo
                    ? <span className="attach-support-badge supported">✓ Supported</span>
                    : <span className="attach-unsupported-badge">Gemini recommended</span>
                  }
                </button>

                {showVideoInput && (
                  <div className="attach-video-input" id="attach-video-input-area">
                    <input
                      className="attach-url-input"
                      placeholder="Paste video URL…"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddVideoUrl()}
                      autoFocus
                      id="video-url-input"
                    />
                    <button className="attach-url-add-btn" onClick={handleAddVideoUrl} id="add-video-url-btn">
                      Add
                    </button>
                  </div>
                )}

                {/* ── Section: AI Tools ── */}
                <div className="attach-menu-section-label" style={{ marginTop: 8 }}>AI Tools</div>

                {/* Embedding */}
                <button className="attach-menu-item" onClick={handleActivateEmbed} id="attach-embed-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                  <span>Generate Embedding</span>
                  <span className="attach-support-badge embed-badge">🔢 Vector</span>
                </button>

                {/* TTS */}
                <button className="attach-menu-item" onClick={handleActivateTTS} id="attach-tts-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                  <span>Text to Speech</span>
                  <span className="attach-support-badge tts-badge">🔊 Audio</span>
                </button>

              </div>
            )}
          </div>
        )}

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

        {/* Textarea */}
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={isStreaming ? 'Generating…' : modeInfo.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
            id="chat-input-textarea"
            aria-label={mode === 'embed' ? 'Text to embed' : mode === 'tts' ? 'Text to speak' : 'Chat message'}
            style={mode !== 'chat' ? { color: modeInfo.color } : {}}
          />
          {charCount > 500 && (
            <span className="char-count">{charCount.toLocaleString()}</span>
          )}
        </div>

        {/* Actions */}
        <div className="input-actions">
          {isStreaming ? (
            <button className="send-btn stop-btn" onClick={onStop} title="Stop generation" id="stop-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Stop
            </button>
          ) : (
            <button
              className={`send-btn ${mode !== 'chat' ? `send-btn-${mode}` : ''} ${!canSend ? 'disabled' : ''}`}
              onClick={handleSend}
              disabled={!canSend}
              title={
                mode === 'embed' ? 'Generate Embedding' :
                mode === 'tts'   ? 'Convert to Speech' :
                sendOnEnter ? 'Send (Enter)' : 'Send (Ctrl+Enter)'
              }
              id="send-btn"
            >
              {mode === 'embed' && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                </svg>
              )}
              {mode === 'tts' && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
              {mode === 'chat' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
              {mode === 'embed' ? 'Embed' : mode === 'tts' ? 'Speak' : 'Send'}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="input-footer">
        <span className="input-hint">
          {mode !== 'chat'
            ? <><kbd>Esc</kbd> to cancel</>
            : sendOnEnter
              ? <><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</>
              : <><kbd>Ctrl+Enter</kbd> to send · <kbd>Enter</kbd> for new line</>
          }
        </span>

        {/* Model capability badges */}
        <div className="modality-badges">
          {supportsImage && <span className="modality-badge" title="This model supports image input">📷 Vision</span>}
          {supportsAudio && <span className="modality-badge" title="This model supports audio input">🎵 Audio</span>}
          {supportsVideo && <span className="modality-badge" title="This model supports video input">🎥 Video</span>}
          {!supportsImage && !supportsAudio && !supportsVideo && (
            <span className="modality-badge text-only-badge" title="This model supports text input only">📝 Text only</span>
          )}
        </div>

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
