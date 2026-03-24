<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import BookshelfView from './components/BookshelfView.vue'
import ReaderView from './components/ReaderView.vue'
import SettingsView from './components/SettingsView.vue'

type View = 'bookshelf' | 'reader' | 'settings'

const currentView = ref<View>('bookshelf')
const selectedBookId = ref<number | null>(null)
const isImmersive = ref(false)
const showQuitConfirm = ref(false)

const openBook = (bookId: number) => {
  selectedBookId.value = bookId
  currentView.value = 'reader'
}

const goBack = () => {
  currentView.value = 'bookshelf'
  selectedBookId.value = null
  isImmersive.value = false
  window.electronAPI.win.setFullScreen(false)
}



const toggleImmersive = async (val: boolean) => {
  isImmersive.value = val
  await window.electronAPI.win.setFullScreen(val)
}

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (showQuitConfirm.value) {
      window.electronAPI.app.quit()
      return
    }
    if (currentView.value === 'settings') {
      goBack()
      return
    }
    if (currentView.value === 'bookshelf') {
      showQuitConfirm.value = true
      return
    }
  } else if (e.key === 'Enter' && showQuitConfirm.value) {
    window.electronAPI.app.quit()
  }
}

const cancelQuit = () => { showQuitConfirm.value = false }
const confirmQuit = () => { window.electronAPI.app.quit() }

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  try {
    const s = await window.electronAPI.db.query("SELECT value FROM settings WHERE key = 'autoOpenLastRead'")
    if (s[0] && s[0].value === 'true') {
      const b = await window.electronAPI.db.query("SELECT id FROM books ORDER BY last_read DESC LIMIT 1")
      if (b[0] && b[0].id) {
        selectedBookId.value = b[0].id
        currentView.value = 'reader'
      }
    }
  } catch (e) {}
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="min-h-screen bg-[#111111] text-white selection:bg-blue-500/30 overflow-hidden font-['Segoe_UI',_sans-serif]">
    <!-- Quit Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showQuitConfirm" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center" @click.self="cancelQuit">
        <div class="bg-[#2d2d2d] p-6 rounded-xl max-w-sm w-full shadow-2xl border border-white/5 text-center">
          <h3 class="text-xl font-bold mb-2">退出阅读器</h3>
          <p class="text-sm text-slate-300 mb-6">确定要退出 EleWinReader 吗？</p>
          <div class="flex gap-3">
            <button @click="cancelQuit" class="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors font-semibold border border-white/5">取消</button>
            <button @click="confirmQuit" class="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition-colors font-semibold text-white">退出 (ESC/Enter)</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade" mode="out-in">
      <!-- Full Screen Reader -->
      <ReaderView
        v-if="currentView === 'reader' && selectedBookId"
        :book-id="selectedBookId"
        @toggle-immersive="toggleImmersive"
        @go-back="goBack"
      />
      
      <!-- PowerToys Style App Layout -->
      <div v-else class="flex h-screen w-full">
        <!-- Sidebar -->
        <aside class="w-[280px] bg-transparent flex flex-col pt-6 shrink-0 z-10">
          <div class="px-5 mb-6 flex items-center gap-3 window-drag">
            <div class="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-lg shadow-sm font-italic">E</div>
            <h1 class="text-[16px] font-semibold text-white/90">EleWinReader</h1>
          </div>
          
          <nav class="flex-1 px-3 space-y-1">
            <button @click="currentView = 'bookshelf'" 
                    :class="currentView === 'bookshelf' ? 'bg-white/10 relative' : 'hover:bg-white/[0.04]'"
                    class="w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 group">
              <div v-if="currentView === 'bookshelf'" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-400 rounded-r-full"></div>
              <span class="text-[16px] w-6 flex justify-center opacity-80 group-hover:opacity-100">📚</span>
              <span class="text-sm font-medium opacity-90">书架大厅</span>
            </button>
            
            <button @click="currentView = 'settings'" 
                    :class="currentView === 'settings' ? 'bg-white/10 relative' : 'hover:bg-white/[0.04]'"
                    class="w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 group">
              <div v-if="currentView === 'settings'" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-400 rounded-r-full"></div>
              <span class="text-[16px] w-6 flex justify-center opacity-80 group-hover:opacity-100">⚙️</span>
              <span class="text-sm font-medium opacity-90">偏好设置</span>
            </button>
          </nav>
        </aside>
        
        <!-- Content Pane -->
        <main class="flex-1 bg-[#202020] rounded-tl-lg border-t border-l border-white/5 relative z-0 flex flex-col shadow-[-4px_-4px_15px_rgba(0,0,0,0.3)] mt-2">
          <!-- Draggable Top Bar Area -->
          <div class="h-8 max-h-8 w-full window-drag shrink-0 rounded-tl-lg"></div>
          
          <div class="flex-1 overflow-y-auto custom-scrollbar px-10 pb-10">
            <Transition name="fade" mode="out-in">
              <BookshelfView
                v-if="currentView === 'bookshelf'"
                @open-book="openBook"
                class="fade-element max-w-7xl mx-auto"
              />
              <SettingsView
                v-else-if="currentView === 'settings'"
                @back="currentView = 'bookshelf'"
                @refresh-settings="() => {}"
                class="fade-element max-w-5xl mx-auto"
              />
            </Transition>
          </div>
        </main>
      </div>
    </Transition>
  </div>
</template>

<style>
@import './index.css';
</style>
