import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { Conversation, ConversationMeta, Settings } from '../../src/types/index'

// ──────────────────────────────────────────────────────────
// Paths
// ──────────────────────────────────────────────────────────
function getConversationsDir(): string {
  return path.join(app.getPath('userData'), 'conversations')
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function ensureDirectories(): void {
  const dir = getConversationsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ──────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  defaultModel: 'anthropic/claude-sonnet-4.6',
  defaultSystemPrompt:
    'You are a helpful, knowledgeable, and concise assistant running inside Vellum Desktop.',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  theme: 'dark',
  fontSize: 14,
  sendOnEnter: true,
  pinnedModels: ['anthropic/claude-sonnet-4.6', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'],
}

// ──────────────────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────────────────
export function getSettings(): Settings {
  try {
    const p = getSettingsPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    }
  } catch {
    // Fall through to default
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: Settings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

// ──────────────────────────────────────────────────────────
// Conversations — full CRUD
// ──────────────────────────────────────────────────────────

/** Returns metadata list sorted newest-first (no messages included) */
export function listConversations(): ConversationMeta[] {
  ensureDirectories()
  const dir = getConversationsDir()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  const metas: ConversationMeta[] = []

  for (const file of files) {
    try {
      const conv: Conversation = JSON.parse(
        fs.readFileSync(path.join(dir, file), 'utf-8')
      )
      const lastMsg = conv.messages.filter((m) => m.role !== 'system').at(-1)
      metas.push({
        id: conv.id,
        title: conv.title,
        model: conv.model,
        messageCount: conv.messages.filter((m) => m.role !== 'system').length,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        preview: lastMsg?.content?.slice(0, 120) ?? '',
      })
    } catch {
      // Skip corrupted files
    }
  }

  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Returns a full conversation including all messages */
export function getConversation(id: string): Conversation | null {
  try {
    const p = path.join(getConversationsDir(), `${id}.json`)
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch {
    return null
  }
  return null
}

/** Persists a full conversation to disk */
export function saveConversation(conversation: Conversation): void {
  ensureDirectories()
  const p = path.join(getConversationsDir(), `${conversation.id}.json`)
  fs.writeFileSync(p, JSON.stringify(conversation, null, 2), 'utf-8')
}

/** Deletes a conversation file; returns true if found */
export function deleteConversation(id: string): boolean {
  const p = path.join(getConversationsDir(), `${id}.json`)
  if (fs.existsSync(p)) {
    fs.unlinkSync(p)
    return true
  }
  return false
}

/** Generate a cryptographically random UUID */
export function generateId(): string {
  return crypto.randomUUID()
}
