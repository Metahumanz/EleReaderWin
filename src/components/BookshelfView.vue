<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Book {
  id: number
  title: string
  author: string | null
  cover_path: string | null
  path: string
  progress_index: number
  progress_offset: number
  last_read: string
}

const emit = defineEmits<{
  (e: 'open-book', bookId: number): void
}>()

const books = ref<Book[]>([])
const loading = ref(true)
const importing = ref(false)

const fetchBooks = async () => {
  try {
    loading.value = true
    const result = await window.electronAPI.db.query(
      'SELECT * FROM books ORDER BY last_read DESC'
    )
    books.value = result as Book[]
  } catch (error) {
    console.error('Failed to fetch books:', error)
  } finally {
    loading.value = false
  }
}

const addBook = async () => {
  const filePath = await window.electronAPI.dialog.openFile()
  if (!filePath) return

  try {
    importing.value = true
    const result = await window.electronAPI.db.importBook(filePath)
    console.log(`Imported ${result.chapterCount} chapters`)
    await fetchBooks()
  } catch (error) {
    console.error('Failed to add book:', error)
    alert('导入失败: ' + (error as Error).message)
  } finally {
    importing.value = false
  }
}

const deleteBook = async (bookId: number) => {
  if (!confirm('确定要删除这本书吗？相关章节也会被删除。')) return

  try {
    await window.electronAPI.db.query('DELETE FROM chapters WHERE book_id = ?', [bookId])
    await window.electronAPI.db.query('DELETE FROM books WHERE id = ?', [bookId])
    await fetchBooks()
  } catch (error) {
    console.error('Failed to delete book:', error)
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  fetchBooks()
})
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold">书架</h2>
      <button
        @click="addBook"
        :disabled="importing"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg transition-colors"
      >
        {{ importing ? '导入中...' : '+ 添加书籍' }}
      </button>
    </div>

    <div v-if="loading" class="text-center text-slate-400 py-12">
      加载中...
    </div>

    <div v-else-if="books.length === 0" class="text-center text-slate-400 py-12">
      <p class="mb-4">还没有书籍</p>
      <button
        @click="addBook"
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
      >
        添加第一本书
      </button>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div
        v-for="book in books"
        :key="book.id"
        class="relative bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors cursor-pointer group"
        @click="emit('open-book', book.id)"
      >
        <div class="aspect-[3/4] bg-slate-700 flex items-center justify-center">
          <span class="text-4xl">📖</span>
        </div>
        <div class="p-3">
          <h3 class="font-medium truncate">{{ book.title }}</h3>
          <p v-if="book.author" class="text-sm text-slate-400 truncate">{{ book.author }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ formatDate(book.last_read) }}</p>
        </div>
        <button
          @click.stop="deleteBook(book.id)"
          class="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded opacity-0 group-hover:opacity-100 transition-opacity text-sm"
        >
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>
