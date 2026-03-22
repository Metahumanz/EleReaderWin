import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
    importBook: (filePath: string) => ipcRenderer.invoke('db:importBook', filePath)
  },
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openImage: () => ipcRenderer.invoke('dialog:openImage')
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
  },
  win: {
    setAspectRatio: (ratio: number) => ipcRenderer.invoke('win:setAspectRatio', ratio),
    setFullScreen: (isFull: boolean) => ipcRenderer.invoke('win:setFullScreen', isFull)
  },
  font: {
    getSystemFonts: () => ipcRenderer.invoke('font:getSystemFonts')
  }
})
