import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type {
  ChatRequest,
  Conversation,
  ConversationMeta,
  ModelInfo,
  Settings,
  EmbeddingRequest,
  EmbeddingResult,
  TranscriptionRequest,
  TTSRequest,
} from '../src/types/index'

// ──────────────────────────────────────────────────────────
// Type aliases for IPC event payloads
// ──────────────────────────────────────────────────────────
type TokenData    = { requestId: string; token: string }
type DoneData     = { requestId: string; fullText: string }
type ErrorData    = { requestId: string; error: string }
type AbortedData  = { requestId: string }

// Helper: register a listener and return its unsubscribe function
function on<T>(
  channel: string,
  cb: (data: T) => void
): () => void {
  const handler = (_: IpcRendererEvent, data: T) => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// ──────────────────────────────────────────────────────────
// Exposed API — accessible via window.vellum in renderer
// ──────────────────────────────────────────────────────────
const api = {
  // ── Chat ─────────────────────────────────────────────
  startChat: (request: ChatRequest) => ipcRenderer.send('chat:start', request),
  stopChat:  (requestId: string)    => ipcRenderer.invoke('chat:stop', requestId),

  onChatToken:   (cb: (data: TokenData)   => void) => on<TokenData>('chat:token',   cb),
  onChatDone:    (cb: (data: DoneData)    => void) => on<DoneData>('chat:done',     cb),
  onChatError:   (cb: (data: ErrorData)   => void) => on<ErrorData>('chat:error',   cb),
  onChatAborted: (cb: (data: AbortedData) => void) => on<AbortedData>('chat:aborted', cb),

  // ── Models ───────────────────────────────────────────
  fetchAllModels: (): Promise<ModelInfo[]>             => ipcRenderer.invoke('models:fetchAll'),
  fetchOneModel:  (id: string): Promise<ModelInfo | null> => ipcRenderer.invoke('models:fetchOne', id),

  // ── Conversations ────────────────────────────────────
  listConversations: (): Promise<ConversationMeta[]>       => ipcRenderer.invoke('conversations:list'),
  getConversation:   (id: string): Promise<Conversation | null> => ipcRenderer.invoke('conversations:get', id),
  saveConversation:  (conv: Conversation): Promise<{ ok: boolean }> => ipcRenderer.invoke('conversations:save', conv),
  deleteConversation:(id: string): Promise<boolean>        => ipcRenderer.invoke('conversations:delete', id),

  // ── Settings ─────────────────────────────────────────
  getSettings:  (): Promise<Settings>                   => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: Settings): Promise<{ ok: boolean }> => ipcRenderer.invoke('settings:save', s),

  // ── Window controls ──────────────────────────────────
  minimizeWindow:  () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow:  () => ipcRenderer.invoke('window:maximize'),
  closeWindow:     () => ipcRenderer.invoke('window:close'),
  isMaximized:     (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),

  // ── File export ──────────────────────────────────────
  exportConversation: (conv: Conversation, format: 'md' | 'json'): Promise<{ ok: boolean; filePath?: string }> =>
    ipcRenderer.invoke('conversation:export', conv, format),

  // ── File I/O ─────────────────────────────────────────
  readFileAsBase64: (filePath: string): Promise<{ data: string; mimeType: string; fileName: string }> =>
    ipcRenderer.invoke('file:readBase64', filePath),

  pickFile: (options: { accept: string; title?: string }): Promise<{ filePath: string; fileName: string } | null> =>
    ipcRenderer.invoke('file:pick', options),

  // ── Multimodal AI ────────────────────────────────────
  requestEmbedding: (req: EmbeddingRequest): Promise<EmbeddingResult> =>
    ipcRenderer.invoke('ai:embedding', req),

  requestTranscription: (req: TranscriptionRequest): Promise<{ text: string }> =>
    ipcRenderer.invoke('ai:transcribe', req),

  requestTTS: (req: TTSRequest): Promise<{ audioBase64: string; mimeType: string }> =>
    ipcRenderer.invoke('ai:tts', req),

  // ── Shell ────────────────────────────────────────────
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),
}

// Expose API under window.vellum
contextBridge.exposeInMainWorld('vellum', api)

export type VellumAPI = typeof api
