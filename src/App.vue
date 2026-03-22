<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BookshelfView from './components/BookshelfView.vue'
import ReaderView from './components/ReaderView.vue'
import SettingsView from './components/SettingsView.vue'

type View = 'bookshelf' | 'reader' | 'settings'

const currentView = ref<View>('bookshelf')
const selectedBookId = ref<number | null>(null)
const bgImage = ref('')
const isImmersive = ref(false)

const loadUserSettings = async () => {
  try {
    const result = await window.electronAPI.db.query("SELECT value FROM settings WHERE key = 'bgImage'")
    if (Array.isArray(result) && result.length > 0 && result[0].value) {
      bgImage.value = result[0].value
    } else {
      bgImage.value = ''
    }
  } catch (e) {
    console.error('Failed to load user settings:', e)
  }
}

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

const bgStyle = () => {
  if (!bgImage.value) return {}
  return {
    backgroundImage: `url('${bgImage.value}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }
}

onMounted(() => {
  loadUserSettings()
})
</script>

<template>
  <div 
    class="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 transition-all duration-500"
    :style="bgStyle()"
  >
    <!-- Background Overlay for contrast -->
    <div v-if="bgImage" class="fixed inset-0 bg-slate-950/50 pointer-events-none"></div>

    <!-- Navigation -->
    <nav 
      v-if="!isImmersive || currentView !== 'reader'"
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
      :class="[!isImmersive || currentView !== 'reader' ? 'pt-14' : '']"
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
          class="fade-element"
        />
        <SettingsView
          v-else-if="currentView === 'settings'"
          @back="goBack"
          @refresh-settings="loadUserSettings"
          class="fade-element"
        />
      </Transition>
    </main>
  </div>
</template>

<style>
@import './index.css';
</style>
