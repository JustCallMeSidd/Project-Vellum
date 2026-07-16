// ──────────────────────────────────────────────────────────
// Chat & Conversation types
// ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: number
  model?: string
  error?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  systemPrompt: string
  createdAt: number
  updatedAt: number
}

/** Lightweight metadata — no messages — used for sidebar list */
export interface ConversationMeta {
  id: string
  title: string
  model: string
  messageCount: number
  createdAt: number
  updatedAt: number
  preview: string
}

// ──────────────────────────────────────────────────────────
// OpenRouter model types (matches API response)
// ──────────────────────────────────────────────────────────

export interface ModelArchitecture {
  input_modalities: string[]
  output_modalities: string[]
  tokenizer?: string
  instruct_type?: string | null
}

export interface ModelInfo {
  id: string
  name: string
  description?: string
  context_length?: number
  architecture: ModelArchitecture
  pricing?: {
    prompt?: string
    completion?: string
    image?: string
    request?: string
  }
  top_provider?: {
    context_length?: number
    max_completion_tokens?: number
    is_moderated?: boolean
  }
  per_request_limits?: Record<string, string> | null
}

// ──────────────────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────────────────

export interface Settings {
  apiKey: string
  defaultModel: string
  defaultSystemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  theme: 'dark' | 'light'
  fontSize: number
  sendOnEnter: boolean
  pinnedModels: string[]
}

// ──────────────────────────────────────────────────────────
// Chat IPC request
// ──────────────────────────────────────────────────────────

export interface ChatRequest {
  requestId: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  options?: {
    temperature?: number
    maxTokens?: number
    topP?: number
  }
}

// ──────────────────────────────────────────────────────────
// Window.vellum global type declaration
// ──────────────────────────────────────────────────────────

export interface VellumAPI {
  startChat: (request: ChatRequest) => void
  stopChat:  (requestId: string) => Promise<void>
  onChatToken:   (cb: (data: { requestId: string; token: string }) => void) => () => void
  onChatDone:    (cb: (data: { requestId: string; fullText: string }) => void) => () => void
  onChatError:   (cb: (data: { requestId: string; error: string }) => void) => () => void
  onChatAborted: (cb: (data: { requestId: string }) => void) => () => void
  fetchAllModels: () => Promise<ModelInfo[]>
  fetchOneModel:  (id: string) => Promise<ModelInfo | null>
  listConversations: () => Promise<ConversationMeta[]>
  getConversation:   (id: string) => Promise<Conversation | null>
  saveConversation:  (conv: Conversation) => Promise<{ ok: boolean }>
  deleteConversation:(id: string) => Promise<boolean>
  getSettings:  () => Promise<Settings>
  saveSettings: (s: Settings) => Promise<{ ok: boolean }>
  minimizeWindow:  () => Promise<void>
  maximizeWindow:  () => Promise<void>
  closeWindow:     () => Promise<void>
  isMaximized:     () => Promise<boolean>
  exportConversation: (conv: Conversation, format: 'md' | 'json') => Promise<{ ok: boolean; filePath?: string }>
}

declare global {
  interface Window {
    vellum: VellumAPI
  }
}
