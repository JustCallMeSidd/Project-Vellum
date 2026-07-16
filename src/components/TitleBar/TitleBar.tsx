import { useState, useEffect } from 'react'
import './TitleBar.css'

interface Props {
  title: string
  currentModel: string
  onOpenSettings: () => void
  onOpenModelBrowser: () => void
}

export function TitleBar({ title, currentModel, onOpenSettings, onOpenModelBrowser }: Props) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.vellum.isMaximized().then(setIsMaximized)
  }, [])

  const handleMaximize = async () => {
    await window.vellum.maximizeWindow()
    const m = await window.vellum.isMaximized()
    setIsMaximized(m)
  }

  // Shorten model name for display
  const modelDisplay = currentModel.includes('/')
    ? currentModel.split('/')[1]
    : currentModel

  return (
    <header className="titlebar" id="app-titlebar">
      {/* Drag region — covers most of the bar */}
      <div className="titlebar-drag" />

      {/* Left: logo + title */}
      <div className="titlebar-left">
        <div className="titlebar-logo" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--accent)" />
            <path d="M2 17l10 5 10-5" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M2 12l10 5 10-5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>
        <span className="titlebar-appname">Vellum</span>
        {title !== 'Vellum' && (
          <>
            <span className="titlebar-sep">›</span>
            <span className="titlebar-title truncate">{title}</span>
          </>
        )}
      </div>

      {/* Center: active model badge */}
      <button
        className="titlebar-model-badge"
        onClick={onOpenModelBrowser}
        title="Switch model"
        id="titlebar-model-btn"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
        <span className="truncate">{modelDisplay}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Right: action buttons + window controls */}
      <div className="titlebar-right">
        <button
          className="titlebar-action"
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          id="titlebar-settings-btn"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <div className="titlebar-divider" />

        {/* Window controls — Windows style */}
        <button
          className="win-ctrl win-minimize"
          onClick={() => window.vellum.minimizeWindow()}
          title="Minimize"
          id="win-ctrl-minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button
          className="win-ctrl win-maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          id="win-ctrl-maximize"
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 0H10V8H8V2H0V0H2Z" fill="none" stroke="currentColor" strokeWidth="1"/>
              <rect x="0" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          )}
        </button>
        <button
          className="win-ctrl win-close"
          onClick={() => window.vellum.closeWindow()}
          title="Close"
          id="win-ctrl-close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
