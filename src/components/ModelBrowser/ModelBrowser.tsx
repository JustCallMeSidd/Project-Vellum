import { useState, useMemo } from 'react'
import type { ModelInfo } from '../../types/index'
import './ModelBrowser.css'

interface Props {
  models: ModelInfo[]
  currentModel: string
  pinnedModels: string[]
  isLoading: boolean
  onSelect: (modelId: string) => void
  onPin: (modelId: string) => void
  onClose: () => void
}

type Filter = 'all' | 'free' | 'vision' | 'audio' | 'pinned'

const PROVIDERS: Record<string, { color: string; label: string }> = {
  openai:        { color: '#10a37f', label: 'OpenAI' },
  anthropic:     { color: '#cc8855', label: 'Anthropic' },
  google:        { color: '#4285f4', label: 'Google' },
  'meta-llama':  { color: '#0668e1', label: 'Meta' },
  mistralai:     { color: '#ff6f00', label: 'Mistral' },
  cohere:        { color: '#39594d', label: 'Cohere' },
  deepseek:      { color: '#5c6bc0', label: 'DeepSeek' },
  'x-ai':        { color: '#1da1f2', label: 'xAI' },
  qwen:          { color: '#e94444', label: 'Qwen' },
}

function getProvider(modelId: string) {
  const prefix = modelId.split('/')[0]
  return PROVIDERS[prefix] ?? { color: '#7c3aed', label: prefix ?? 'Unknown' }
}

function isFree(model: ModelInfo): boolean {
  const p = model.pricing?.prompt ?? '0'
  const c = model.pricing?.completion ?? '0'
  return parseFloat(p) === 0 && parseFloat(c) === 0
}

function hasModality(model: ModelInfo, mod: string): boolean {
  return model.architecture?.input_modalities?.includes(mod) ?? false
}

function formatContext(ctx?: number): string {
  if (!ctx) return '—'
  return ctx >= 1000 ? `${(ctx / 1000).toFixed(0)}K` : String(ctx)
}

function formatPrice(p?: string): string {
  if (!p || parseFloat(p) === 0) return 'Free'
  const n = parseFloat(p) * 1_000_000
  return `$${n.toFixed(2)}/M`
}

export function ModelBrowser({ models, currentModel, pinnedModels, isLoading, onSelect, onPin, onClose }: Props) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<Filter>('all')
  const [hovered, setHovered] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = models
    if (filter === 'free')   list = list.filter(isFree)
    if (filter === 'vision') list = list.filter((m) => hasModality(m, 'image'))
    if (filter === 'audio')  list = list.filter((m) => hasModality(m, 'audio'))
    if (filter === 'pinned') list = list.filter((m) => pinnedModels.includes(m.id))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          (m.description ?? '').toLowerCase().includes(q)
      )
    }
    // Sort: pinned first, then alphabetical by name
    return [...list].sort((a, b) => {
      const aPinned = pinnedModels.includes(a.id) ? -1 : 1
      const bPinned = pinnedModels.includes(b.id) ? -1 : 1
      if (aPinned !== bPinned) return aPinned - bPinned
      return a.name.localeCompare(b.name)
    })
  }, [models, filter, search, pinnedModels])

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'pinned', label: `⭐ Pinned (${pinnedModels.length})` },
    { key: 'free',   label: 'Free' },
    { key: 'vision', label: '🖼 Vision' },
    { key: 'audio',  label: '🎙 Audio' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose} id="model-browser-overlay">
      <div
        className="modal-panel model-browser-panel"
        onClick={(e) => e.stopPropagation()}
        id="model-browser-panel"
      >
        {/* Header */}
        <div className="mb-header">
          <div>
            <h2 className="mb-title">Model Browser</h2>
            <p className="mb-subtitle">
              {isLoading ? 'Loading catalog…' : `${models.length} models available via OpenRouter`}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close" id="model-browser-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search + filters */}
        <div className="mb-controls">
          <div className="mb-search-wrapper">
            <svg className="mb-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="mb-search input"
              type="text"
              placeholder="Search models, providers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              id="model-browser-search"
            />
            {search && (
              <button className="mb-search-clear" onClick={() => setSearch('')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          <div className="mb-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`mb-filter-btn ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
                id={`model-filter-${f.key}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model list */}
        <div className="mb-list" id="model-list">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-skeleton" style={{ animationDelay: `${i * 50}ms` }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="mb-empty">No models found for "{search}"</div>
          ) : (
            filtered.map((model) => {
              const prov      = getProvider(model.id)
              const isCurrent = model.id === currentModel
              const isPinned  = pinnedModels.includes(model.id)
              const free      = isFree(model)
              const hasVision = hasModality(model, 'image')
              const hasAudio  = hasModality(model, 'audio')

              return (
                <div
                  key={model.id}
                  className={`mb-card ${isCurrent ? 'current' : ''} ${hovered === model.id ? 'hovered' : ''}`}
                  onMouseEnter={() => setHovered(model.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelect(model.id)}
                  id={`model-card-${model.id.replace(/\//g, '-')}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(model.id)}
                >
                  {/* Provider dot */}
                  <div
                    className="mb-provider-dot"
                    style={{ background: prov.color }}
                    title={prov.label}
                  />

                  {/* Info */}
                  <div className="mb-info">
                    <div className="mb-name-row">
                      <span className="mb-name">{model.name}</span>
                      {isCurrent && <span className="mb-current-badge">In use</span>}
                      {isPinned && <span className="mb-pin-icon" title="Pinned">⭐</span>}
                    </div>
                    <div className="mb-id">{model.id}</div>
                    {model.description && (
                      <div className="mb-desc">{model.description.slice(0, 120)}{model.description.length > 120 ? '…' : ''}</div>
                    )}
                    <div className="mb-tags">
                      {free     && <span className="badge badge-free">Free</span>}
                      {hasVision&& <span className="badge badge-vision">Vision</span>}
                      {hasAudio && <span className="badge badge-audio">Audio</span>}
                      <span className="mb-meta">ctx {formatContext(model.context_length)}</span>
                      {!free && (
                        <span className="mb-meta">{formatPrice(model.pricing?.prompt)} in</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mb-actions">
                    <button
                      className={`mb-pin-btn ${isPinned ? 'pinned' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onPin(model.id) }}
                      title={isPinned ? 'Unpin' : 'Pin model'}
                      id={`pin-btn-${model.id.replace(/\//g, '-')}`}
                    >
                      ⭐
                    </button>
                    {!isCurrent && (
                      <button
                        className="btn btn-primary mb-select-btn"
                        onClick={(e) => { e.stopPropagation(); onSelect(model.id) }}
                        id={`select-btn-${model.id.replace(/\//g, '-')}`}
                      >
                        Use
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="mb-footer">
          <span>{filtered.length} model{filtered.length !== 1 ? 's' : ''} shown</span>
          <a
            onClick={() => { /* handled by shell.openExternal in main */ }}
            className="mb-link"
          >
            Browse all at openrouter.ai/models ↗
          </a>
        </div>
      </div>
    </div>
  )
}
