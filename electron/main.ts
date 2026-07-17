import { app, BrowserWindow, ipcMain, Tray, Menu, dialog, nativeImage, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as mime from 'mime-types'
import {
  fetchAllModels, fetchModelInfo, streamChat, stopChat,
  fetchEmbeddings, transcribeAudio, textToSpeech,
} from './api/openrouter'
import {
  getSettings,
  saveSettings,
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  ensureDirectories,
} from './api/storage'
import type { EmbeddingRequest, TranscriptionRequest, TTSRequest } from '../src/types/index'

// ──────────────────────────────────────────────────────────
// Window & Tray references
// ──────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ──────────────────────────────────────────────────────────
// Resolve icon path — works in dev AND production
// ──────────────────────────────────────────────────────────
function getIconPath(): string {
  const devPath  = path.join(process.cwd(), 'public', 'icon.png')
  const prodPath = path.join(__dirname, '..', 'dist', 'icon.png')
  return fs.existsSync(devPath) ? devPath : prodPath
}

// ──────────────────────────────────────────────────────────
// Create main window
// ──────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = getIconPath()
  const iconImage = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#080810',
    show: false,
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.setAlwaysOnTop(true)
    setTimeout(() => {
      mainWindow?.setAlwaysOnTop(false)
    }, 1000)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ──────────────────────────────────────────────────────────
// System tray
// ──────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Vellum — AI Chat')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Vellum',
      click: () => { mainWindow?.show(); mainWindow?.focus() },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ──────────────────────────────────────────────────────────
// IPC: Window controls
// ──────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

// ──────────────────────────────────────────────────────────
// IPC: Shell — open links in browser
// ──────────────────────────────────────────────────────────
ipcMain.handle('shell:openExternal', async (_, url: string) => {
  await shell.openExternal(url)
})

// ──────────────────────────────────────────────────────────
// IPC: File picker
// ──────────────────────────────────────────────────────────
ipcMain.handle('file:pick', async (_, options: { accept: string; title?: string }) => {
  const filters: Electron.FileFilter[] = []

  if (options.accept.includes('image')) {
    filters.push({ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] })
  }
  if (options.accept.includes('audio')) {
    filters.push({ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] })
  }
  if (options.accept.includes('video')) {
    filters.push({ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] })
  }
  if (filters.length === 0) {
    filters.push({ name: 'All Files', extensions: ['*'] })
  }

  const result = await dialog.showOpenDialog({
    title: options.title ?? 'Select File',
    filters,
    properties: ['openFile'],
  })

  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return { filePath, fileName: path.basename(filePath) }
})

// ──────────────────────────────────────────────────────────
// IPC: Read file as base64
// ──────────────────────────────────────────────────────────
ipcMain.handle('file:readBase64', async (_, filePath: string) => {
  const buffer = fs.readFileSync(filePath)
  const data = buffer.toString('base64')
  const mimeType = (mime.lookup(filePath) as string | false) || 'application/octet-stream'
  const fileName = path.basename(filePath)
  return { data, mimeType, fileName }
})

// ──────────────────────────────────────────────────────────
// IPC: Chat — streaming via push events
// ──────────────────────────────────────────────────────────
ipcMain.on('chat:start', async (event, request) => {
  const sender = event.sender
  await streamChat(request, {
    onToken: (requestId, token) => {
      if (!sender.isDestroyed()) sender.send('chat:token', { requestId, token })
    },
    onDone: (requestId, fullText) => {
      if (!sender.isDestroyed()) sender.send('chat:done', { requestId, fullText })
    },
    onError: (requestId, error) => {
      if (!sender.isDestroyed()) sender.send('chat:error', { requestId, error })
    },
    onAborted: (requestId) => {
      if (!sender.isDestroyed()) sender.send('chat:aborted', { requestId })
    },
  })
})

ipcMain.handle('chat:stop', async (_, requestId: string) => {
  stopChat(requestId)
})

// ──────────────────────────────────────────────────────────
// IPC: Models
// ──────────────────────────────────────────────────────────
ipcMain.handle('models:fetchAll', async () => {
  return fetchAllModels()
})

ipcMain.handle('models:fetchOne', async (_, modelId: string) => {
  return fetchModelInfo(modelId)
})

// ──────────────────────────────────────────────────────────
// IPC: Conversations CRUD
// ──────────────────────────────────────────────────────────
ipcMain.handle('conversations:list', async () => {
  return listConversations()
})

ipcMain.handle('conversations:get', async (_, id: string) => {
  return getConversation(id)
})

ipcMain.handle('conversations:save', async (_, conversation) => {
  saveConversation(conversation)
  return { ok: true }
})

ipcMain.handle('conversations:delete', async (_, id: string) => {
  return deleteConversation(id)
})

// ──────────────────────────────────────────────────────────
// IPC: Settings
// ──────────────────────────────────────────────────────────
ipcMain.handle('settings:get', async () => {
  return getSettings()
})

ipcMain.handle('settings:save', async (_, settings) => {
  saveSettings(settings)
  return { ok: true }
})

// ──────────────────────────────────────────────────────────
// IPC: Embeddings
// ──────────────────────────────────────────────────────────
ipcMain.handle('ai:embedding', async (_, req: EmbeddingRequest) => {
  return fetchEmbeddings(req)
})

// ──────────────────────────────────────────────────────────
// IPC: Audio Transcription
// ──────────────────────────────────────────────────────────
ipcMain.handle('ai:transcribe', async (_, req: TranscriptionRequest) => {
  return transcribeAudio(req)
})

// ──────────────────────────────────────────────────────────
// IPC: Text-to-Speech
// ──────────────────────────────────────────────────────────
ipcMain.handle('ai:tts', async (_, req: TTSRequest) => {
  return textToSpeech(req)
})

// ──────────────────────────────────────────────────────────
// IPC: Export conversation
// ──────────────────────────────────────────────────────────
ipcMain.handle('conversation:export', async (_, conversation, format: 'md' | 'json') => {
  const ext = format === 'json' ? 'json' : 'md'
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Conversation',
    defaultPath: `${conversation.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`,
    filters: [
      format === 'json'
        ? { name: 'JSON', extensions: ['json'] }
        : { name: 'Markdown', extensions: ['md'] },
    ],
  })

  if (canceled || !filePath) return { ok: false }

  let content: string
  if (format === 'json') {
    content = JSON.stringify(conversation, null, 2)
  } else {
    const lines: string[] = [
      `# ${conversation.title}`,
      `**Model:** ${conversation.model}`,
      `**Date:** ${new Date(conversation.createdAt).toLocaleString()}`,
      '',
      '---',
      '',
    ]
    for (const msg of conversation.messages) {
      if (msg.role === 'system') continue
      lines.push(`## ${msg.role === 'user' ? '👤 You' : '🤖 Assistant'}`)
      lines.push(msg.content)
      lines.push('')
    }
    content = lines.join('\n')
  }

  fs.writeFileSync(filePath, content, 'utf-8')
  shell.showItemInFolder(filePath)
  return { ok: true, filePath }
})

// ──────────────────────────────────────────────────────────
// App lifecycle
// ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureDirectories()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
