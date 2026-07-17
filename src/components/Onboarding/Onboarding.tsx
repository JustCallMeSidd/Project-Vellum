import { useState, useEffect } from 'react'
import type { ModelInfo } from '../../types/index'
import './Onboarding.css'

interface Props {
  onComplete: (apiKey: string, model: string) => void
}

// ── Well-known popular models to show in onboarding ──────
const POPULAR_MODELS = [
  { id: 'openai/gpt-4o',                   name: 'GPT-4o',             badge: 'Vision',   desc: 'OpenAI flagship — fast & multimodal' },
  { id: 'openai/gpt-4o-mini',              name: 'GPT-4o mini',        badge: 'Fast',     desc: 'Affordable & quick for most tasks' },
  { id: 'anthropic/claude-sonnet-4',       name: 'Claude Sonnet 4',    badge: 'Vision',   desc: 'Anthropic — excellent reasoning' },
  { id: 'anthropic/claude-haiku-3.5',      name: 'Claude Haiku 3.5',   badge: 'Fast',     desc: 'Anthropic — blazing fast responses' },
  { id: 'google/gemini-2.0-flash-001',     name: 'Gemini 2.0 Flash',   badge: 'Vision',   desc: 'Google — supports images & audio' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B',   badge: 'Free',     desc: 'Open source, powerful & free' },
  { id: 'openai/gpt-oss-20b:free',         name: 'GPT OSS 20B',        badge: 'Free',     desc: 'Open source — no cost' },
  { id: 'deepseek/deepseek-chat',          name: 'DeepSeek Chat',      badge: 'Free',     desc: 'DeepSeek — excellent free option' },
]

type Step = 'key' | 'model' | 'ready'

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('key')
  const [apiKey, setApiKey] = useState('')
  const [keyError, setKeyError] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini')
  const [customModel, setCustomModel] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [liveModels, setLiveModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  // Fetch live model list once API key is validated
  useEffect(() => {
    if (step !== 'model') return
    setModelsLoading(true)
    window.vellum.fetchAllModels()
      .then((models) => {
        setLiveModels(models)
      })
      .catch(() => setLiveModels([]))
      .finally(() => setModelsLoading(false))
  }, [step])

  const validateKey = async () => {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      setKeyError('Please enter your OpenRouter API key.')
      return
    }
    if (!trimmed.startsWith('sk-')) {
      setKeyError('API keys should start with "sk-". Double-check you copied the full key.')
      return
    }

    setKeyError('')
    setIsValidating(true)

    // Validate by hitting the models endpoint
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${trimmed}` },
      })
      if (!res.ok) {
        setKeyError('That key doesn\'t seem valid — check it and try again.')
        setIsValidating(false)
        return
      }
      // Key is good — proceed
      setStep('model')
    } catch {
      setKeyError('Could not reach OpenRouter. Check your internet connection.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleComplete = () => {
    const model = customModel.trim() || selectedModel
    onComplete(apiKey.trim(), model)
  }

  // Filter live models by search
  const filteredLiveModels = liveModels.filter((m) => {
    const q = modelSearch.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
  }).slice(0, 30)

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Logo */}
        <div className="ob-logo">
          <div className="ob-logo-icon">
            <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
              <defs>
                <linearGradient id="ob-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a78bfa"/>
                  <stop offset="100%" stopColor="#6366f1"/>
                </linearGradient>
              </defs>
              <circle cx="30" cy="30" r="28" fill="url(#ob-grad)" opacity="0.15"/>
              <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
                fontSize="32" fontWeight="700" fill="url(#ob-grad)" fontFamily="'Inter','Segoe UI',sans-serif">V</text>
            </svg>
          </div>
          <h1 className="ob-title">Welcome to Vellum</h1>
          <p className="ob-subtitle">Your private AI desktop — connect once, chat forever.</p>
        </div>

        {/* Step indicator */}
        <div className="ob-steps">
          <div className={`ob-step ${step === 'key' ? 'active' : step === 'model' || step === 'ready' ? 'done' : ''}`}>
            <div className="ob-step-dot">{step === 'key' ? '1' : '✓'}</div>
            <span>API Key</span>
          </div>
          <div className="ob-step-line" />
          <div className={`ob-step ${step === 'model' ? 'active' : step === 'ready' ? 'done' : ''}`}>
            <div className="ob-step-dot">2</div>
            <span>Choose Model</span>
          </div>
        </div>

        {/* ── STEP 1: API Key ── */}
        {step === 'key' && (
          <div className="ob-section ob-fade-in">
            <div className="ob-section-title">Enter your OpenRouter API Key</div>
            <p className="ob-section-desc">
              Vellum uses OpenRouter to access 300+ AI models. Your key is stored only on your device — never shared.
            </p>

            <div className="ob-key-link-row">
              <span>Don't have a key yet?</span>
              <button
                className="ob-link-btn"
                onClick={() => window.vellum.openExternal('https://openrouter.ai/keys')}
              >
                Get a free API key at OpenRouter →
              </button>
            </div>

            <div className="ob-input-group">
              <label className="ob-label" htmlFor="ob-api-key-input">API Key</label>
              <div className="ob-input-wrap">
                <svg className="ob-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="ob-api-key-input"
                  type="password"
                  className={`ob-input ${keyError ? 'error' : ''}`}
                  placeholder="sk-or-v1-••••••••••••••••"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && validateKey()}
                  autoFocus
                />
              </div>
              {keyError && <div className="ob-error">{keyError}</div>}
            </div>

            <button
              className="ob-primary-btn"
              onClick={validateKey}
              disabled={isValidating || !apiKey.trim()}
              id="ob-connect-btn"
            >
              {isValidating ? (
                <>
                  <div className="ob-spinner" />
                  Verifying…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  Get Connected
                </>
              )}
            </button>

            <p className="ob-privacy-note">
              🔒 Your API key is stored locally in your app data folder and never sent to any third-party server other than OpenRouter.
            </p>
          </div>
        )}

        {/* ── STEP 2: Choose Model ── */}
        {step === 'model' && (
          <div className="ob-section ob-fade-in">
            <div className="ob-section-title">Choose your default AI model</div>
            <p className="ob-section-desc">
              You can switch models anytime during chat. Pick one to start with.
            </p>

            {/* Quick picks */}
            <div className="ob-model-grid">
              {POPULAR_MODELS.map((m) => (
                <button
                  key={m.id}
                  className={`ob-model-card ${selectedModel === m.id && !customModel ? 'selected' : ''}`}
                  onClick={() => { setSelectedModel(m.id); setCustomModel('') }}
                >
                  <div className="ob-model-header">
                    <span className="ob-model-name">{m.name}</span>
                    <span className={`ob-model-badge badge-${m.badge.toLowerCase()}`}>{m.badge}</span>
                  </div>
                  <div className="ob-model-desc">{m.desc}</div>
                </button>
              ))}
            </div>

            {/* Live search */}
            <div className="ob-model-search-section">
              <div className="ob-or-divider"><span>or search all models</span></div>
              <div className="ob-input-wrap">
                <svg className="ob-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  className="ob-input"
                  placeholder="Search 300+ models… e.g. 'claude', 'llama', 'gpt'"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                />
              </div>

              {modelSearch.trim() && (
                <div className="ob-model-search-results">
                  {modelsLoading ? (
                    <div className="ob-search-loading">Loading model catalog…</div>
                  ) : filteredLiveModels.length === 0 ? (
                    <div className="ob-search-loading">No models found for "{modelSearch}"</div>
                  ) : (
                    filteredLiveModels.map((m) => (
                      <button
                        key={m.id}
                        className={`ob-search-result ${selectedModel === m.id && !customModel ? 'selected' : ''}`}
                        onClick={() => { setSelectedModel(m.id); setCustomModel(''); setModelSearch('') }}
                      >
                        <span className="ob-sr-name">{m.name}</span>
                        <span className="ob-sr-id">{m.id}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Custom model ID */}
              <div className="ob-custom-model">
                <label className="ob-label">Or enter a custom model ID</label>
                <input
                  className="ob-input"
                  placeholder="e.g. openai/o1-mini"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              </div>
            </div>

            <div className="ob-selected-model-preview">
              Selected: <strong>{customModel.trim() || selectedModel}</strong>
            </div>

            <button
              className="ob-primary-btn"
              onClick={handleComplete}
              id="ob-start-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
              Start Chatting
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
