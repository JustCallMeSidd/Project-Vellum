import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Conversation,
  ConversationMeta,
  ChatMessage,
  ModelInfo,
  Settings,
} from './types/index'
import { TitleBar }     from './components/TitleBar/TitleBar'
import { Sidebar }      from './components/Sidebar/Sidebar'
import { ChatPanel }    from './components/ChatPanel/ChatPanel'
import { ModelBrowser } from './components/ModelBrowser/ModelBrowser'
import { SettingsPanel }from './components/Settings/Settings'
import { Toast }        from './components/Toast/Toast'

// ── Helper: generate unique IDs ───────────────────────────
function uid(): string {
  return crypto.randomUUID()
}

// ── Helper: derive a conversation title from first message ─
function deriveTitle(content: string): string {
  const clean = content.trim().replace(/\n/g, ' ')
  return clean.length > 50 ? clean.slice(0, 47) + '…' : clean
}

// ── Toast state ───────────────────────────────────────────
interface ToastMessage {
  id: string
  text: string
  type: 'success' | 'error' | 'info'
}

export default function App() {
  // ── App state ─────────────────────────────────────────
  const [settings, setSettings]         = useState<Settings | null>(null)
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConv, setActiveConv]     = useState<Conversation | null>(null)
  const [models, setModels]             = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  // ── UI state ──────────────────────────────────────────
  const [isModelBrowserOpen, setModelBrowserOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen]         = useState(false)
  const [toasts, setToasts]                       = useState<ToastMessage[]>([])

  // ── Streaming state ───────────────────────────────────
  const [isStreaming, setIsStreaming]   = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const streamRequestId = useRef<string | null>(null)
  const unsubscribers   = useRef<Array<() => void>>([])

  // ────────────────────────────────────────────────────────
  // Boot: load settings + conversations
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const [s, convs] = await Promise.all([
        window.vellum.getSettings(),
        window.vellum.listConversations(),
      ])
      setSettings(s)
      setConversations(convs)

      // Apply theme
      document.documentElement.setAttribute('data-theme', s.theme)
      document.documentElement.style.fontSize = `${s.fontSize}px`

      // Open settings if no API key yet
      if (!s.apiKey) {
        setSettingsOpen(true)
      }
    }
    boot()
  }, [])

  // ────────────────────────────────────────────────────────
  // Load models once settings are available
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings?.apiKey) return
    setModelsLoading(true)
    window.vellum.fetchAllModels()
      .then(setModels)
      .catch(() => showToast('Could not load model catalog', 'error'))
      .finally(() => setModelsLoading(false))
  }, [settings?.apiKey])

  // ────────────────────────────────────────────────────────
  // Load a conversation when activeConvId changes
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId) { setActiveConv(null); return }
    window.vellum.getConversation(activeConvId).then((conv) => {
      if (conv) setActiveConv(conv)
    })
  }, [activeConvId])

  // ────────────────────────────────────────────────────────
  // Toast helpers
  // ────────────────────────────────────────────────────────
  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = uid()
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  // ────────────────────────────────────────────────────────
  // Conversation management
  // ────────────────────────────────────────────────────────
  const createConversation = useCallback(async () => {
    if (!settings) return
    const now = Date.now()
    const newConv: Conversation = {
      id:           uid(),
      title:        'New conversation',
      messages:     [
        {
          id: uid(),
          role: 'system',
          content: settings.defaultSystemPrompt,
          timestamp: now,
        },
      ],
      model:        settings.defaultModel,
      systemPrompt: settings.defaultSystemPrompt,
      createdAt:    now,
      updatedAt:    now,
    }
    await window.vellum.saveConversation(newConv)
    const updated = await window.vellum.listConversations()
    setConversations(updated)
    setActiveConvId(newConv.id)
  }, [settings])

  const deleteConversation = useCallback(async (id: string) => {
    await window.vellum.deleteConversation(id)
    const updated = await window.vellum.listConversations()
    setConversations(updated)
    if (activeConvId === id) {
      setActiveConvId(updated[0]?.id ?? null)
    }
    showToast('Conversation deleted', 'info')
  }, [activeConvId, showToast])

  const renameConversation = useCallback(async (id: string, title: string) => {
    const conv = await window.vellum.getConversation(id)
    if (!conv) return
    const updated = { ...conv, title, updatedAt: Date.now() }
    await window.vellum.saveConversation(updated)
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    )
    if (activeConvId === id) setActiveConv(updated)
  }, [activeConvId])

  const persistConversation = useCallback(async (conv: Conversation) => {
    await window.vellum.saveConversation(conv)
    // Refresh sidebar meta
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              title: conv.title,
              model: conv.model,
              messageCount: conv.messages.filter((m) => m.role !== 'system').length,
              updatedAt: conv.updatedAt,
              preview: conv.messages.filter((m) => m.role !== 'system').at(-1)?.content?.slice(0, 120) ?? '',
            }
          : c
      ).sort((a, b) => b.updatedAt - a.updatedAt)
    )
  }, [])

  // ────────────────────────────────────────────────────────
  // Model switching
  // ────────────────────────────────────────────────────────
  const changeModel = useCallback(async (modelId: string) => {
    if (!activeConv) return
    const updated = { ...activeConv, model: modelId, updatedAt: Date.now() }
    setActiveConv(updated)
    await persistConversation(updated)
  }, [activeConv, persistConversation])

  // ────────────────────────────────────────────────────────
  // Streaming — clean up IPC listeners
  // ────────────────────────────────────────────────────────
  const clearStreamListeners = useCallback(() => {
    unsubscribers.current.forEach((fn) => fn())
    unsubscribers.current = []
  }, [])

  // ────────────────────────────────────────────────────────
  // Send a message
  // ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!activeConv || !settings || isStreaming) return

    const requestId = uid()
    const now = Date.now()

    // Append user message
    const userMsg: ChatMessage = {
      id: uid(), role: 'user', content, timestamp: now,
    }
    const convWithUser: Conversation = {
      ...activeConv,
      messages:  [...activeConv.messages, userMsg],
      updatedAt: now,
      // Auto-title from first user message
      title: activeConv.messages.filter(m => m.role !== 'system').length === 0
        ? deriveTitle(content)
        : activeConv.title,
    }
    setActiveConv(convWithUser)

    // Set up streaming state
    setIsStreaming(true)
    setStreamingText('')
    streamRequestId.current = requestId

    let accumulated = ''

    // Register IPC listeners
    clearStreamListeners()
    unsubscribers.current = [
      window.vellum.onChatToken((data) => {
        if (data.requestId !== requestId) return
        accumulated += data.token
        setStreamingText(accumulated)
      }),
      window.vellum.onChatDone((data) => {
        if (data.requestId !== requestId) return
        clearStreamListeners()
        setIsStreaming(false)
        setStreamingText('')
        streamRequestId.current = null

        const assistantMsg: ChatMessage = {
          id: uid(), role: 'assistant', content: data.fullText,
          timestamp: Date.now(), model: activeConv.model,
        }
        const finalConv: Conversation = {
          ...convWithUser,
          messages:  [...convWithUser.messages, assistantMsg],
          updatedAt: Date.now(),
        }
        setActiveConv(finalConv)
        persistConversation(finalConv)
      }),
      window.vellum.onChatError((data) => {
        if (data.requestId !== requestId) return
        clearStreamListeners()
        setIsStreaming(false)
        setStreamingText('')
        streamRequestId.current = null

        const errMsg: ChatMessage = {
          id: uid(), role: 'assistant',
          content: `⚠️ **Error:** ${data.error}`,
          timestamp: Date.now(), error: true,
        }
        const errConv: Conversation = {
          ...convWithUser,
          messages: [...convWithUser.messages, errMsg],
          updatedAt: Date.now(),
        }
        setActiveConv(errConv)
        persistConversation(errConv)
        showToast('Request failed — check your API key and try again', 'error')
      }),
      window.vellum.onChatAborted((data) => {
        if (data.requestId !== requestId) return
        clearStreamListeners()
        setIsStreaming(false)
        setStreamingText('')
        streamRequestId.current = null

        if (accumulated.trim()) {
          const partialMsg: ChatMessage = {
            id: uid(), role: 'assistant',
            content: accumulated + '\n\n*[Generation stopped]*',
            timestamp: Date.now(), model: activeConv.model,
          }
          const stoppedConv: Conversation = {
            ...convWithUser,
            messages: [...convWithUser.messages, partialMsg],
            updatedAt: Date.now(),
          }
          setActiveConv(stoppedConv)
          persistConversation(stoppedConv)
        }
        showToast('Generation stopped', 'info')
      }),
    ]

    // Fire the request
    window.vellum.startChat({
      requestId,
      apiKey:   settings.apiKey,
      model:    convWithUser.model,
      messages: convWithUser.messages,
      options: {
        temperature: settings.temperature,
        maxTokens:   settings.maxTokens,
        topP:        settings.topP,
      },
    })

    // Persist the user message immediately
    persistConversation(convWithUser)
  }, [activeConv, settings, isStreaming, clearStreamListeners, persistConversation, showToast])

  // ────────────────────────────────────────────────────────
  // Stop generation
  // ────────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    if (streamRequestId.current) {
      window.vellum.stopChat(streamRequestId.current)
    }
  }, [])

  // ────────────────────────────────────────────────────────
  // Regenerate last assistant response
  // ────────────────────────────────────────────────────────
  const regenerateLast = useCallback(() => {
    if (!activeConv || isStreaming) return
    const msgs = activeConv.messages.filter((m) => m.role !== 'system')
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return

    // Remove last assistant message
    const trimmed = [...activeConv.messages]
    const lastIdx = trimmed.map((m) => m.id).lastIndexOf(
      [...activeConv.messages].reverse().find((m) => m.role === 'assistant')?.id ?? ''
    )
    if (lastIdx !== -1) trimmed.splice(lastIdx, 1)

    const newConv = { ...activeConv, messages: trimmed, updatedAt: Date.now() }
    setActiveConv(newConv)
    sendMessage(lastUser.content)
  }, [activeConv, isStreaming, sendMessage])

  // ────────────────────────────────────────────────────────
  // Save settings
  // ────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    await window.vellum.saveSettings(newSettings)
    setSettings(newSettings)
    document.documentElement.setAttribute('data-theme', newSettings.theme)
    document.documentElement.style.fontSize = `${newSettings.fontSize}px`
    setSettingsOpen(false)
    showToast('Settings saved', 'success')

    // Reload models if API key changed
    if (newSettings.apiKey && newSettings.apiKey !== settings?.apiKey) {
      setModelsLoading(true)
      window.vellum.fetchAllModels()
        .then(setModels)
        .catch(() => showToast('Could not load model catalog', 'error'))
        .finally(() => setModelsLoading(false))
    }
  }, [settings?.apiKey, showToast])

  // ────────────────────────────────────────────────────────
  // Export conversation
  // ────────────────────────────────────────────────────────
  const exportConversation = useCallback(async (format: 'md' | 'json') => {
    if (!activeConv) return
    const result = await window.vellum.exportConversation(activeConv, format)
    if (result.ok) {
      showToast(`Exported as ${format.toUpperCase()}`, 'success')
    }
  }, [activeConv, showToast])

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────
  if (!settings) {
    return (
      <div style={{
        width:'100%', height:'100%', display:'flex',
        alignItems:'center', justifyContent:'center',
        background: 'var(--bg-base)', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)'
      }}>
        <div style={{ textAlign:'center' }}>
          <div className="spin" style={{ width:32, height:32, border:'2px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto 16px' }} />
          <div>Starting Vellum…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Custom title bar */}
      <TitleBar
        title={activeConv?.title ?? 'Vellum'}
        currentModel={activeConv?.model ?? settings.defaultModel}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenModelBrowser={() => setModelBrowserOpen(true)}
      />

      {/* Main layout */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={setActiveConvId}
          onNew={createConversation}
          onDelete={deleteConversation}
          onRename={renameConversation}
        />

        <ChatPanel
          conversation={activeConv}
          settings={settings}
          isStreaming={isStreaming}
          streamingText={streamingText}
          onSendMessage={sendMessage}
          onStopGeneration={stopGeneration}
          onChangeModel={changeModel}
          onOpenModelBrowser={() => setModelBrowserOpen(true)}
          onRegenerate={regenerateLast}
          onExport={exportConversation}
          onNewChat={createConversation}
        />
      </div>

      {/* Model browser modal */}
      {isModelBrowserOpen && (
        <ModelBrowser
          models={models}
          currentModel={activeConv?.model ?? settings.defaultModel}
          pinnedModels={settings.pinnedModels}
          isLoading={modelsLoading}
          onSelect={(id) => {
            changeModel(id)
            setModelBrowserOpen(false)
          }}
          onPin={(id) => {
            const pinned = settings.pinnedModels.includes(id)
              ? settings.pinnedModels.filter((p) => p !== id)
              : [...settings.pinnedModels, id]
            const updated = { ...settings, pinnedModels: pinned }
            handleSaveSettings(updated)
          }}
          onClose={() => setModelBrowserOpen(false)}
        />
      )}

      {/* Settings panel */}
      {isSettingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Toast stack */}
      <div style={{
        position:'fixed', bottom:24, right:24,
        display:'flex', flexDirection:'column', gap:8, zIndex:2000,
        pointerEvents:'none'
      }}>
        {toasts.map((t) => (
          <Toast key={t.id} text={t.text} type={t.type} />
        ))}
      </div>
    </div>
  )
}
