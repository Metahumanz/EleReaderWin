import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
    importBook: (filePath: string) => ipcRenderer.invoke('db:importBook', filePath)
  },
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile')
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
  }
})
