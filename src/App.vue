<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BookshelfView from './components/BookshelfView.vue'
import ReaderView from './components/ReaderView.vue'
import SettingsView from './components/SettingsView.vue'

type View = 'bookshelf' | 'reader' | 'settings'

const currentView = ref<View>('bookshelf')
const selectedBookId = ref<number | null>(null)
const isImmersive = ref(false)

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

onMounted(() => {
  // No global bg image needed — reader handles its own bg
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 transition-all duration-500">
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
