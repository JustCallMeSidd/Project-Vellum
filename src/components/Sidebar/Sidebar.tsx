import { useState, useRef, useEffect } from 'react'
import type { ConversationMeta } from '../../types/index'
import './Sidebar.css'

interface Props {
  conversations: ConversationMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename }: Props) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus()
      editRef.current.select()
    }
  }, [editingId])

  const filtered = conversations.filter((c) =>
    search === '' ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.preview.toLowerCase().includes(search.toLowerCase())
  )

  const startEdit = (c: ConversationMeta) => {
    setEditingId(c.id)
    setEditText(c.title)
  }

  const commitEdit = () => {
    if (editingId && editText.trim()) {
      onRename(editingId, editText.trim())
    }
    setEditingId(null)
  }

  // Get short model provider name
  const modelProvider = (model: string) => model.split('/')[0] ?? model

  // Group by recency
  const today   = filtered.filter(c => Date.now() - c.updatedAt < 86400000)
  const week    = filtered.filter(c => Date.now() - c.updatedAt >= 86400000 && Date.now() - c.updatedAt < 604800000)
  const older   = filtered.filter(c => Date.now() - c.updatedAt >= 604800000)

  const renderGroup = (label: string, items: ConversationMeta[]) => {
    if (!items.length) return null
    return (
      <div className="sidebar-group" key={label}>
        <div className="sidebar-group-label">{label}</div>
        {items.map((c, i) => (
          <div
            key={c.id}
            className={`sidebar-item ${c.id === activeId ? 'active' : ''}`}
            style={{ animationDelay: `${i * 30}ms` }}
            onClick={() => onSelect(c.id)}
            onMouseEnter={() => setHoveredId(c.id)}
            onMouseLeave={() => setHoveredId(null)}
            onDoubleClick={() => startEdit(c)}
            id={`sidebar-conv-${c.id}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(c.id)}
          >
            {editingId === c.id ? (
              <input
                ref={editRef}
                className="sidebar-rename-input input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  { e.preventDefault(); commitEdit() }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="sidebar-item-body">
                  <div className="sidebar-item-title truncate">{c.title}</div>
                  <div className="sidebar-item-meta">
                    <span className="sidebar-item-provider">{modelProvider(c.model)}</span>
                    <span className="sidebar-item-dot">·</span>
                    <span className="sidebar-item-date">{formatDate(c.updatedAt)}</span>
                    {c.messageCount > 0 && (
                      <>
                        <span className="sidebar-item-dot">·</span>
                        <span className="sidebar-item-count">{c.messageCount} msg{c.messageCount !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                  {c.preview && (
                    <div className="sidebar-item-preview truncate">{c.preview}</div>
                  )}
                </div>

                {/* Action buttons — visible on hover */}
                {(hoveredId === c.id || c.id === activeId) && (
                  <div className="sidebar-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="sidebar-action-btn"
                      title="Rename (double-click)"
                      onClick={() => startEdit(c)}
                      id={`rename-btn-${c.id}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      className="sidebar-action-btn danger"
                      title="Delete conversation"
                      onClick={() => onDelete(c.id)}
                      id={`delete-btn-${c.id}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <aside className="sidebar" id="app-sidebar">
      {/* New chat button */}
      <div className="sidebar-header">
        <button
          className="new-chat-btn btn btn-primary"
          onClick={onNew}
          id="new-chat-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="sidebar-search-input"
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="sidebar-search"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')} title="Clear">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Conversation list */}
      <div className="sidebar-list">
        {filtered.length === 0 ? (
          <div className="sidebar-empty">
            {search ? `No results for "${search}"` : 'No conversations yet'}
          </div>
        ) : (
          <>
            {renderGroup('Today', today)}
            {renderGroup('This Week', week)}
            {renderGroup('Older', older)}
          </>
        )}
      </div>
    </aside>
  )
}
