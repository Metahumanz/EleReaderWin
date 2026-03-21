/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  db: {
    query: (sql: string, params?: any[]) => Promise<any>
    importBook: (filePath: string) => Promise<{ bookId: number; chapterCount: number }>
  }
  dialog: {
    openFile: () => Promise<string | null>
  }
  shell: {
    openPath: (path: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
