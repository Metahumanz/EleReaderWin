import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, extname } from 'path'
import { is } from '@electron-toolkit/utils'
import initSqlJs, { Database } from 'sql.js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { parseTxt, parseEpub } from './parsers'
import { autoUpdater } from 'electron-updater'

let mainWindow: BrowserWindow | null = null
let db: Database | null = null
let dbPath: string = ''

// ---- Window bounds persistence ----
const boundsFile = join(app.getPath('userData'), 'window-bounds.json')
function loadBounds(): Electron.Rectangle | null {
  try { if (existsSync(boundsFile)) return JSON.parse(readFileSync(boundsFile, 'utf8')) } catch {}
  return null
}
function saveBounds(): void {
  if (!mainWindow) return
  try { writeFileSync(boundsFile, JSON.stringify(mainWindow.getBounds())) } catch {}
}

// ---- Auto updater setup ----
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:status', { status: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:status', { status: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:status', { status: 'up-to-date' })
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:status', { status: 'downloading', percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('updater:status', { status: 'downloaded' })
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:status', { status: 'error', message: String(err) })
  })
}

function createWindow(): void {
  const saved = loadBounds()
  mainWindow = new BrowserWindow({
    width: saved?.width || 1200,
    height: saved?.height || 800,
    x: saved?.x,
    y: saved?.y,
    minWidth: 300,
    minHeight: 300,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

function saveDatabase(): void {
  if (db) { writeFileSync(dbPath, Buffer.from(db.export())) }
}

function getWasmPath(): string {
  const wasmFileName = 'sql-wasm.wasm'
  const paths = [
    join(process.resourcesPath, 'sql.js', wasmFileName),
    join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', wasmFileName),
    join(app.getAppPath(), 'node_modules/sql.js/dist/', wasmFileName),
    join(process.cwd(), 'node_modules/sql.js/dist/', wasmFileName),
    join(__dirname, '../node_modules/sql.js/dist/', wasmFileName),
    join(__dirname, '../../node_modules/sql.js/dist/', wasmFileName)
  ]
  for (const p of paths) { if (existsSync(p)) return p }
  throw new Error(`WASM not found. Tried:\n${paths.join('\n')}`)
}

async function initDatabase(): Promise<void> {
  const wasmPath = getWasmPath()
  const wasmBuffer = readFileSync(wasmPath)
  const SQL = await initSqlJs({ wasmBinary: wasmBuffer.buffer })
  dbPath = join(app.getPath('userData'), 'reader.db')
  db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database()

  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, author TEXT, cover_path TEXT, path TEXT,
    progress_index INTEGER DEFAULT 0, progress_offset INTEGER DEFAULT 0,
    last_read DATETIME DEFAULT CURRENT_TIMESTAMP, source_id INTEGER
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
    order_index INTEGER NOT NULL, link TEXT,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`)
  db.run(`CREATE TABLE IF NOT EXISTS replacement_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL, replacement TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global', is_regex INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
  )`)
  saveDatabase()
}

app.whenReady().then(async () => {
  createWindow()
  try {
    await initDatabase()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database init failed:', error)
    dialog.showErrorBox('数据库初始化失败', String(error))
  }
  setupAutoUpdater()
  // Check for updates on startup (silent)
  if (!is.dev) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000)
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  saveBounds()
  saveDatabase()
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC handlers ----
ipcMain.handle('db:query', async (_, sql: string, params?: any[]) => {
  if (!db) throw new Error('Database not initialized')
  try {
    const t = sql.trim().toUpperCase()
    if (t.startsWith('SELECT')) {
      const result = db.exec(sql, params || [])
      if (result.length === 0) return []
      const { columns, values } = result[0]
      return values.map(row => { const o: any = {}; columns.forEach((c, i) => o[c] = row[i]); return o })
    } else {
      db.run(sql, params || [])
      saveDatabase()
      const r = db.exec('SELECT last_insert_rowid() as id')
      return { lastInsertRowid: r[0]?.values[0]?.[0] || 0, changes: db.getRowsModified() }
    }
  } catch (error) { console.error('DB error:', error); throw error }
})

ipcMain.handle('db:importBook', async (_, filePath: string) => {
  if (!db) throw new Error('Database not initialized')
  try {
    const ext = extname(filePath).toLowerCase()
    const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'
    const title = fileName.replace(/\.[^/.]+$/, '')
    db.run('INSERT INTO books (title, path, last_read) VALUES (?, ?, ?)', [title, filePath, new Date().toISOString()])
    const result = db.exec('SELECT last_insert_rowid() as id')
    const bookId = result[0].values[0][0] as number
    let chapters: { title: string; body: string; orderIndex: number }[]
    if (ext === '.txt') chapters = parseTxt(filePath)
    else if (ext === '.epub') chapters = await parseEpub(filePath)
    else throw new Error(`Unsupported: ${ext}`)
    for (const ch of chapters) {
      db.run('INSERT INTO chapters (book_id, title, body, order_index) VALUES (?, ?, ?, ?)', [bookId, ch.title, ch.body, ch.orderIndex])
    }
    saveDatabase()
    return { bookId, chapterCount: chapters.length }
  } catch (error) { console.error('Import error:', error); throw error }
})

ipcMain.handle('dialog:openFile', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'E-books', extensions: ['txt', 'epub'] }, { name: 'All Files', extensions: ['*'] }] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('dialog:openImage', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'] }] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('shell:openPath', async (_, path: string) => shell.openPath(path))

ipcMain.handle('win:setAspectRatio', async (_, ratio: number) => {
  mainWindow?.setAspectRatio(ratio)
  if (mainWindow) { const [w] = mainWindow.getSize(); mainWindow.setSize(w, Math.round(w / ratio)) }
})

ipcMain.handle('win:setFullScreen', async (_, isFull: boolean) => mainWindow?.setFullScreen(isFull))

ipcMain.handle('font:getSystemFonts', async () => {
  if (process.platform !== 'win32') return []
  const { execSync } = require('child_process')
  try {
    const cmd = 'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }'
    const output = execSync(`powershell -command "${cmd}"`, { encoding: 'utf8', timeout: 15000 })
    return output.split(/\r?\n/).filter((f: string) => f.trim()).sort()
  } catch (e) { console.error('Font error:', e); return [] }
})

ipcMain.handle('updater:check', async () => {
  try { await autoUpdater.checkForUpdates(); return true } catch (e) { return false }
})

ipcMain.handle('updater:install', async () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('app:getVersion', async () => app.getVersion())
