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

const openSettings = () => {
  currentView.value = 'settings'
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

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 transition-all duration-500">
    <!-- Quit Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showQuitConfirm" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center" @click.self="cancelQuit">
        <div class="glass-dark p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-white/10 text-center">
          <h3 class="text-xl font-bold mb-2">退出阅读器</h3>
          <p class="text-sm text-slate-300 mb-6">确定要退出 EleWinReader 吗？</p>
          <div class="flex gap-3">
            <button @click="cancelQuit" class="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-semibold">取消</button>
            <button @click="confirmQuit" class="flex-1 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 transition-all font-semibold shadow-lg shadow-red-500/20">退出 (ESC/Enter)</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Navigation (hidden in reader) -->
    <nav 
      v-if="currentView !== 'reader'"
      class="fixed top-0 left-0 right-0 h-14 glass-dark flex items-center px-6 z-[100] transition-transform duration-300"
    >
      <button
        v-if="currentView !== 'bookshelf'"
        @click="goBack"
        class="mr-4 p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95"
      >
        <span class="text-xl">←</span>
      </button>
      
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold italic shadow-lg shadow-blue-500/20">
          E
        </div>
        <h1 class="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
          EleWinReader
        </h1>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          v-if="currentView === 'bookshelf'"
          @click="openSettings"
          class="p-2.5 hover:bg-white/10 rounded-xl transition-all hover:rotate-45 active:scale-90"
          title="设置"
        >
          <span class="text-xl">⚙️</span>
        </button>
      </div>
    </nav>

    <!-- Main Content -->
    <main 
      class="transition-all duration-500"
      :class="[currentView !== 'reader' ? 'pt-14' : '']"
    >
      <Transition name="fade" mode="out-in">
        <BookshelfView
          v-if="currentView === 'bookshelf'"
          @open-book="openBook"
          class="fade-element"
        />
        <ReaderView
          v-else-if="currentView === 'reader' && selectedBookId"
          :book-id="selectedBookId"
          @toggle-immersive="toggleImmersive"
          @go-back="goBack"
          class="fade-element"
        />
        <SettingsView
          v-else-if="currentView === 'settings'"
          @back="goBack"
          @refresh-settings="() => {}"
          class="fade-element"
        />
      </Transition>
    </main>
  </div>
</template>

<style>
@import './index.css';
</style>
