import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, extname } from 'path'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { parseTxt, parseEpub } from './parsers'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

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

function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'reader.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      cover_path TEXT,
      path TEXT,
      progress_index INTEGER DEFAULT 0,
      progress_offset INTEGER DEFAULT 0,
      last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
      source_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      link TEXT,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS replacement_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      replacement TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      is_regex INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
  `)
}

app.whenReady().then(() => {
  initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (db) {
    db.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('db:query', async (_, sql: string, params?: any[]) => {
  if (!db) throw new Error('Database not initialized')
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...(params || []))
    } else {
      return stmt.run(...(params || []))
    }
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
})

ipcMain.handle('db:importBook', async (_, filePath: string) => {
  if (!db) throw new Error('Database not initialized')

  try {
    const ext = extname(filePath).toLowerCase()
    const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'
    const title = fileName.replace(/\.[^/.]+$/, '')

    const bookResult = db.prepare(
      'INSERT INTO books (title, path, last_read) VALUES (?, ?, ?)'
    ).run(title, filePath, new Date().toISOString())

    const bookId = bookResult.lastInsertRowid as number

    let chapters: { title: string; body: string; orderIndex: number }[]

    if (ext === '.txt') {
      chapters = parseTxt(filePath)
    } else if (ext === '.epub') {
      chapters = await parseEpub(filePath)
    } else {
      throw new Error(`Unsupported file format: ${ext}`)
    }

    const insertChapter = db.prepare(
      'INSERT INTO chapters (book_id, title, body, order_index) VALUES (?, ?, ?, ?)'
    )

    const insertMany = db.transaction((chaps: typeof chapters) => {
      for (const chapter of chaps) {
        insertChapter.run(bookId, chapter.title, chapter.body, chapter.orderIndex)
      }
    })

    insertMany(chapters)

    return { bookId, chapterCount: chapters.length }
  } catch (error) {
    console.error('Import book error:', error)
    throw error
  }
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'E-books', extensions: ['txt', 'epub'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('shell:openPath', async (_, path: string) => {
  return shell.openPath(path)
})
