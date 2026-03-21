import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params)
  },
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile')
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
  }
})
