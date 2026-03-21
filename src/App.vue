<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BookshelfView from './components/BookshelfView.vue'
import ReaderView from './components/ReaderView.vue'
import SettingsView from './components/SettingsView.vue'

type View = 'bookshelf' | 'reader' | 'settings'

const currentView = ref<View>('bookshelf')
const selectedBookId = ref<number | null>(null)

const openBook = (bookId: number) => {
  selectedBookId.value = bookId
  currentView.value = 'reader'
}

const goBack = () => {
  currentView.value = 'bookshelf'
  selectedBookId.value = null
}

const openSettings = () => {
  currentView.value = 'settings'
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <!-- Navigation -->
    <nav class="fixed top-0 left-0 right-0 h-12 bg-slate-800 border-b border-white/10 flex items-center px-4 z-50">
      <button
        v-if="currentView !== 'bookshelf'"
        @click="goBack"
        class="mr-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
      >
        ← 返回
      </button>
      <h1 class="text-lg font-semibold">EleWinReader</h1>
      <div class="ml-auto flex gap-2">
        <button
          v-if="currentView === 'bookshelf'"
          @click="openSettings"
          class="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          ⚙️ 设置
        </button>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="pt-12">
      <BookshelfView
        v-if="currentView === 'bookshelf'"
        @open-book="openBook"
      />
      <ReaderView
        v-else-if="currentView === 'reader' && selectedBookId"
        :book-id="selectedBookId"
      />
      <SettingsView
        v-else-if="currentView === 'settings'"
        @back="goBack"
      />
    </main>
  </div>
</template>

<style>
@import './index.css';
</style>
