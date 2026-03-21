<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Chapter {
  id: number
  title: string
  body: string
  order_index: number
}

interface Book {
  id: number
  title: string
  author: string | null
  path: string
  progress_index: number
  progress_offset: number
}

const props = defineProps<{
  bookId: number
}>()

const book = ref<Book | null>(null)
const chapters = ref<Chapter[]>([])
const currentChapterIndex = ref(0)
const loading = ref(true)
const showToc = ref(false)

const fetchBook = async () => {
  try {
    const result = await window.electronAPI.db.query(
      'SELECT * FROM books WHERE id = ?',
      [props.bookId]
    )
    if (Array.isArray(result) && result.length > 0) {
      book.value = result[0] as Book
      currentChapterIndex.value = book.value.progress_index
    }
  } catch (error) {
    console.error('Failed to fetch book:', error)
  }
}

const fetchChapters = async () => {
  try {
    const result = await window.electronAPI.db.query(
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY order_index',
      [props.bookId]
    )
    chapters.value = result as Chapter[]
  } catch (error) {
    console.error('Failed to fetch chapters:', error)
  }
}

const saveProgress = async () => {
  if (!book.value) return

  try {
    await window.electronAPI.db.query(
      'UPDATE books SET progress_index = ?, last_read = ? WHERE id = ?',
      [currentChapterIndex.value, new Date().toISOString(), props.bookId]
    )
  } catch (error) {
    console.error('Failed to save progress:', error)
  }
}

const goToChapter = (index: number) => {
  if (index >= 0 && index < chapters.value.length) {
    currentChapterIndex.value = index
    showToc.value = false
    saveProgress()
  }
}

const prevChapter = () => {
  goToChapter(currentChapterIndex.value - 1)
}

const nextChapter = () => {
  goToChapter(currentChapterIndex.value + 1)
}

watch(() => props.bookId, async () => {
  loading.value = true
  await fetchBook()
  await fetchChapters()
  loading.value = false
})

onMounted(async () => {
  await fetchBook()
  await fetchChapters()
  loading.value = false
})
</script>

<template>
  <div class="h-screen flex flex-col">
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <p class="text-slate-400">加载中...</p>
    </div>

    <div v-else-if="!book || chapters.length === 0" class="flex-1 flex items-center justify-center">
      <p class="text-slate-400">没有章节内容</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="h-12 bg-slate-800 border-b border-white/10 flex items-center px-4">
        <button
          @click="showToc = !showToc"
          class="mr-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          📋 目录
        </button>
        <h2 class="font-medium truncate">{{ book.title }}</h2>
        <span class="ml-auto text-sm text-slate-400">
          {{ currentChapterIndex + 1 }} / {{ chapters.length }}
        </span>
      </div>

      <!-- Table of Contents Overlay -->
      <div
        v-if="showToc"
        class="fixed inset-0 z-40 bg-black/50"
        @click="showToc = false"
      >
        <div
          class="absolute left-0 top-12 bottom-0 w-80 bg-slate-800 overflow-y-auto"
          @click.stop
        >
          <div class="p-4">
            <h3 class="text-lg font-semibold mb-4">章节目录</h3>
            <ul class="space-y-2">
              <li
                v-for="(chapter, index) in chapters"
                :key="chapter.id"
                @click="goToChapter(index)"
                :class="[
                  'p-2 rounded cursor-pointer transition-colors',
                  index === currentChapterIndex
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-700'
                ]"
              >
                {{ chapter.title }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-3xl mx-auto">
          <h3 class="text-xl font-bold mb-4">{{ chapters[currentChapterIndex]?.title }}</h3>
          <div
            class="prose prose-invert max-w-none"
            v-html="chapters[currentChapterIndex]?.body"
          ></div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="h-14 bg-slate-800 border-t border-white/10 flex items-center justify-between px-4">
        <button
          @click="prevChapter"
          :disabled="currentChapterIndex === 0"
          class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          ← 上一章
        </button>
        <button
          @click="nextChapter"
          :disabled="currentChapterIndex === chapters.length - 1"
          class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          下一章 →
        </button>
      </div>
    </template>
  </div>
</template>
