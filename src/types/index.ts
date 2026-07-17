// ──────────────────────────────────────────────────────────
// Multimodal message content parts
// ──────────────────────────────────────────────────────────

export type MessagePart =
  | { type: 'text';        text: string }
  | { type: 'image_url';   url: string;  fileName?: string; mimeType?: string }
  | { type: 'audio';       data: string; mimeType: string; fileName?: string; transcript?: string }
  | { type: 'video_url';   url: string }
  | { type: 'embedding';   vectors: number[]; dimension: number; model: string }
  | { type: 'tts_audio';   data: string; mimeType: string; voice?: string }

// ──────────────────────────────────────────────────────────
// Chat & Conversation types
// ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string               // plain text fallback / primary text
  parts?: MessagePart[]         // multimodal content parts (when present, used instead of content)
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
// Embedding request
// ──────────────────────────────────────────────────────────

export interface EmbeddingRequest {
  apiKey: string
  model: string   // e.g. "openai/text-embedding-3-small"
  input: string
}

export interface EmbeddingResult {
  vectors: number[]
  dimension: number
  model: string
}

// ──────────────────────────────────────────────────────────
// Transcription request
// ──────────────────────────────────────────────────────────

export interface TranscriptionRequest {
  apiKey: string
  model: string        // e.g. "openai/whisper-1"
  audioBase64: string
  mimeType: string     // e.g. "audio/mpeg"
  fileName: string
}

// ──────────────────────────────────────────────────────────
// TTS request
// ──────────────────────────────────────────────────────────

export interface TTSRequest {
  apiKey: string
  model: string       // e.g. "openai/tts-1"
  text: string
  voice?: string      // e.g. "alloy", "echo", "fable", "onyx", "nova", "shimmer"
}

// ──────────────────────────────────────────────────────────
// Window.vellum global type declaration
// ──────────────────────────────────────────────────────────

export interface VellumAPI {
  // ── Chat ────────────────────────────────────────────────
  startChat: (request: ChatRequest) => void
  stopChat:  (requestId: string) => Promise<void>
  onChatToken:   (cb: (data: { requestId: string; token: string }) => void) => () => void
  onChatDone:    (cb: (data: { requestId: string; fullText: string }) => void) => () => void
  onChatError:   (cb: (data: { requestId: string; error: string }) => void) => () => void
  onChatAborted: (cb: (data: { requestId: string }) => void) => () => void

  // ── Models ──────────────────────────────────────────────
  fetchAllModels: () => Promise<ModelInfo[]>
  fetchOneModel:  (id: string) => Promise<ModelInfo | null>

  // ── Conversations ───────────────────────────────────────
  listConversations: () => Promise<ConversationMeta[]>
  getConversation:   (id: string) => Promise<Conversation | null>
  saveConversation:  (conv: Conversation) => Promise<{ ok: boolean }>
  deleteConversation:(id: string) => Promise<boolean>

  // ── Settings ────────────────────────────────────────────
  getSettings:  () => Promise<Settings>
  saveSettings: (s: Settings) => Promise<{ ok: boolean }>

  // ── Window controls ─────────────────────────────────────
  minimizeWindow:  () => Promise<void>
  maximizeWindow:  () => Promise<void>
  closeWindow:     () => Promise<void>
  isMaximized:     () => Promise<boolean>

  // ── File export ─────────────────────────────────────────
  exportConversation: (conv: Conversation, format: 'md' | 'json') => Promise<{ ok: boolean; filePath?: string }>

  // ── Multimodal: File I/O ────────────────────────────────
  readFileAsBase64: (filePath: string) => Promise<{ data: string; mimeType: string; fileName: string }>

  // ── Multimodal: AI endpoints ────────────────────────────
  requestEmbedding:    (req: EmbeddingRequest)    => Promise<EmbeddingResult>
  requestTranscription:(req: TranscriptionRequest) => Promise<{ text: string }>
  requestTTS:          (req: TTSRequest)           => Promise<{ audioBase64: string; mimeType: string }>

  // ── Shell ───────────────────────────────────────────────
  openExternal: (url: string) => Promise<void>

  // ── File picker ─────────────────────────────────────────
  pickFile: (options: { accept: string; title?: string }) => Promise<{ filePath: string; fileName: string } | null>
}

declare global {
  interface Window {
    vellum: VellumAPI
  }
}
