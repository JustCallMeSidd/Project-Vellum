import { app, BrowserWindow, ipcMain, Tray, Menu, dialog, nativeImage, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { fetchAllModels, fetchModelInfo, streamChat, stopChat } from './api/openrouter'
import {
  getSettings,
  saveSettings,
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  ensureDirectories,
} from './api/storage'

// ──────────────────────────────────────────────────────────
// Window & Tray references
// ──────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ──────────────────────────────────────────────────────────
// Resolve icon path — works in dev AND production
// ──────────────────────────────────────────────────────────
function getIconPath(): string {
  // In dev, __dirname = dist-electron/, public/ is at project root
  // In production, public/ assets are copied to dist/
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
    frame: false,           // Custom frameless window — title bar drawn in React
    transparent: false,
    backgroundColor: '#080810',
    show: false,            // Show only once ready to prevent flash of white
    icon: iconImage,        // NativeImage loaded from ASAR
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // Security: isolate renderer context
      nodeIntegration: false,   // Security: no Node.js in renderer
      sandbox: false,           // Required by vite-plugin-electron-renderer
    },
  })

  // Load dev server in dev mode, production build otherwise
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // DevTools disabled by default to keep screen clean. Use Ctrl+Shift+I to open if needed.
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show window gracefully once ready — force to foreground
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.setAlwaysOnTop(true)   // pop to front
    setTimeout(() => {
      mainWindow?.setAlwaysOnTop(false) // release after 1s so user can Alt-Tab normally
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
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ──────────────────────────────────────────────────────────
// IPC: Window controls
// ──────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.restore()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

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
    // Markdown export
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
