import { useState } from 'react'
import type { Settings } from '../../types/index'
import './Settings.css'

interface Props {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

type Tab = 'api' | 'model' | 'generation' | 'appearance'

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft]     = useState<Settings>({ ...settings })
  const [tab, setTab]         = useState<Tab>('api')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  const update = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }))

  const testApiKey = async () => {
    if (!draft.apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const models = await window.vellum.fetchAllModels()
      setTestResult(models.length > 0 ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'api',
      label: 'API Key',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    },
    {
      key: 'model',
      label: 'Model',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    },
    {
      key: 'generation',
      label: 'Generation',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    },
    {
      key: 'appearance',
      label: 'Appearance',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    },
  ]

  return (
    <div className="modal-overlay" onClick={onClose} id="settings-overlay">
      <div className="modal-panel settings-panel" onClick={(e) => e.stopPropagation()} id="settings-panel">
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="btn-icon" onClick={onClose} id="settings-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Tabs */}
          <nav className="settings-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`settings-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
                id={`settings-tab-${t.key}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="settings-content">

            {/* ── API Key ────────────────────────────── */}
            {tab === 'api' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label className="settings-label" htmlFor="api-key-input">
                    OpenRouter API Key
                  </label>
                  <p className="settings-hint">
                    Get a free key at <strong>openrouter.ai/keys</strong> — works with OpenAI, Anthropic, Google, and 600+ more models.
                  </p>
                  <div className="api-key-row">
                    <input
                      id="api-key-input"
                      className="input input-mono"
                      type={showKey ? 'text' : 'password'}
                      value={draft.apiKey}
                      onChange={(e) => update({ apiKey: e.target.value })}
                      placeholder="sk-or-v1-…"
                      spellCheck={false}
                    />
                    <button
                      className="btn btn-ghost api-key-btn"
                      onClick={() => setShowKey((v) => !v)}
                      id="toggle-key-btn"
                      title={showKey ? 'Hide' : 'Show'}
                    >
                      {showKey ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                    <button
                      className={`btn ${testResult === 'ok' ? 'btn-ghost' : 'btn-ghost'} api-key-btn`}
                      onClick={testApiKey}
                      disabled={!draft.apiKey.trim() || testing}
                      id="test-key-btn"
                      style={{ minWidth: 80 }}
                    >
                      {testing ? (
                        <span className="spin" style={{ display:'inline-block', width:12, height:12, border:'2px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%' }} />
                      ) : testResult === 'ok' ? (
                        <span style={{ color: 'var(--success)' }}>✓ Valid</span>
                      ) : testResult === 'fail' ? (
                        <span style={{ color: 'var(--error)' }}>✗ Invalid</span>
                      ) : (
                        'Test Key'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Model ──────────────────────────────── */}
            {tab === 'model' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label className="settings-label" htmlFor="default-model-input">Default Model</label>
                  <p className="settings-hint">Used when creating a new conversation.</p>
                  <input
                    id="default-model-input"
                    className="input input-mono"
                    value={draft.defaultModel}
                    onChange={(e) => update({ defaultModel: e.target.value })}
                    placeholder="anthropic/claude-sonnet-4.6"
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label" htmlFor="system-prompt-input">Default System Prompt</label>
                  <p className="settings-hint">Applied to every new conversation. Can be overridden per conversation.</p>
                  <textarea
                    id="system-prompt-input"
                    className="input settings-textarea"
                    value={draft.defaultSystemPrompt}
                    onChange={(e) => update({ defaultSystemPrompt: e.target.value })}
                    rows={5}
                    placeholder="You are a helpful assistant…"
                  />
                </div>
              </div>
            )}

            {/* ── Generation ─────────────────────────── */}
            {tab === 'generation' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label className="settings-label">
                    Temperature
                    <span className="settings-value-badge">{draft.temperature.toFixed(1)}</span>
                  </label>
                  <p className="settings-hint">Higher = more creative. Lower = more deterministic.</p>
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={draft.temperature}
                    onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                    className="settings-slider"
                    id="temperature-slider"
                  />
                  <div className="slider-labels"><span>Precise (0)</span><span>Creative (2)</span></div>
                </div>

                <div className="settings-field">
                  <label className="settings-label" htmlFor="max-tokens-input">
                    Max Tokens
                    <span className="settings-value-badge">{draft.maxTokens.toLocaleString()}</span>
                  </label>
                  <p className="settings-hint">Maximum number of tokens in the response.</p>
                  <input
                    id="max-tokens-input"
                    type="number"
                    className="input"
                    value={draft.maxTokens}
                    min={256}
                    max={128000}
                    step={256}
                    onChange={(e) => update({ maxTokens: parseInt(e.target.value) || 4096 })}
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-label">
                    Top P
                    <span className="settings-value-badge">{draft.topP.toFixed(2)}</span>
                  </label>
                  <p className="settings-hint">Nucleus sampling threshold.</p>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={draft.topP}
                    onChange={(e) => update({ topP: parseFloat(e.target.value) })}
                    className="settings-slider"
                    id="top-p-slider"
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-label">Send on Enter</label>
                  <p className="settings-hint">
                    {draft.sendOnEnter
                      ? 'Enter sends, Shift+Enter inserts a new line.'
                      : 'Ctrl+Enter sends, Enter inserts a new line.'}
                  </p>
                  <button
                    className={`toggle-btn ${draft.sendOnEnter ? 'on' : 'off'}`}
                    onClick={() => update({ sendOnEnter: !draft.sendOnEnter })}
                    id="send-on-enter-toggle"
                  >
                    <div className="toggle-knob" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Appearance ─────────────────────────── */}
            {tab === 'appearance' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label className="settings-label">Theme</label>
                  <div className="theme-options">
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        className={`theme-btn ${draft.theme === t ? 'active' : ''}`}
                        onClick={() => update({ theme: t })}
                        id={`theme-${t}-btn`}
                      >
                        {t === 'dark' ? '🌙' : '☀️'} {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-field">
                  <label className="settings-label">
                    Font Size
                    <span className="settings-value-badge">{draft.fontSize}px</span>
                  </label>
                  <input
                    type="range" min="11" max="20" step="1"
                    value={draft.fontSize}
                    onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                    className="settings-slider"
                    id="font-size-slider"
                  />
                  <div className="slider-labels"><span>Small (11px)</span><span>Large (20px)</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="btn btn-ghost" onClick={onClose} id="settings-cancel-btn">Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)} id="settings-save-btn">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
