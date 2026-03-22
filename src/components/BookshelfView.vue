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
  pinned: number
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
    const result = await window.electronAPI.db.query('SELECT * FROM books ORDER BY pinned DESC, last_read DESC')
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
  if (!confirm('确定要删除这本书吗？')) return
  try {
    await window.electronAPI.db.query('DELETE FROM replacement_rules WHERE book_id = ?', [bookId])
    await window.electronAPI.db.query('DELETE FROM chapters WHERE book_id = ?', [bookId])
    await window.electronAPI.db.query('DELETE FROM books WHERE id = ?', [bookId])
    await fetchBooks()
  } catch (error) {
    console.error('Failed to delete book:', error)
  }
}

const setCover = async (bookId: number) => {
  const filePath = await window.electronAPI.dialog.openImage()
  if (!filePath) return
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')
  try {
    await window.electronAPI.db.query('UPDATE books SET cover_path = ? WHERE id = ?', [fileUrl, bookId])
    await fetchBooks()
  } catch (error) {
    console.error('Failed to set cover:', error)
  }
}

const removeCover = async (bookId: number) => {
  try {
    await window.electronAPI.db.query('UPDATE books SET cover_path = NULL WHERE id = ?', [bookId])
    await fetchBooks()
  } catch (error) {
    console.error('Failed to remove cover:', error)
  }
}

const togglePin = async (book: Book) => {
  const newVal = book.pinned ? 0 : 1
  try {
    await window.electronAPI.db.query('UPDATE books SET pinned = ? WHERE id = ?', [newVal, book.id])
    await fetchBooks()
  } catch (error) {
    console.error('Failed to toggle pin:', error)
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

onMounted(() => fetchBooks())
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h2 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">我的书架</h2>
        <p class="text-slate-400 text-sm mt-1">共 {{ books.length }} 本书籍</p>
      </div>
      <button @click="addBook" :disabled="importing"
        class="group px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95">
        <span class="text-lg group-hover:scale-110 transition-transform">{{ importing ? '⏳' : '+' }}</span>
        <span class="font-medium">{{ importing ? '正在导入...' : '添加书籍' }}</span>
      </button>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      <p class="text-slate-400 animate-pulse">正在获取书籍...</p>
    </div>

    <div v-else-if="books.length === 0" class="text-center py-24 glass-dark rounded-3xl border-dashed border-2 border-white/5 mx-auto max-w-md">
      <div class="text-6xl mb-6">📚</div>
      <p class="text-lg text-slate-300 mb-6">书架空空如也</p>
      <p class="text-sm text-slate-500 mb-4">支持 TXT 和 EPUB 格式</p>
      <button @click="addBook" class="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 active:scale-95">开启阅读之旅</button>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      <div v-for="book in books" :key="book.id" class="relative group cursor-pointer" @click="emit('open-book', book.id)">
        <div class="aspect-[3/4.2] glass-dark rounded-2xl overflow-hidden relative shadow-xl shadow-black/20 group-hover:shadow-blue-500/10 group-hover:-translate-y-2 transition-all duration-500 border border-white/5 group-hover:border-blue-500/30"
             :class="{'ring-2 ring-amber-400/50': book.pinned}">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>

          <!-- Pin badge -->
          <div v-if="book.pinned" class="absolute top-2 left-2 z-20 text-amber-400 text-xs font-bold bg-black/40 backdrop-blur-md rounded-lg px-2 py-0.5">📌 置顶</div>

          <!-- Cover image or default icon -->
          <img v-if="book.cover_path" :src="book.cover_path" class="w-full h-full object-cover" alt="封面" @error="(e: Event) => (e.target as HTMLImageElement).style.display='none'" />
          <div v-else class="h-full w-full flex items-center justify-center">
            <span class="text-6xl group-hover:scale-110 transition-transform duration-500">📖</span>
          </div>

          <!-- Actions -->
          <div class="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
            <button @click.stop="togglePin(book)" class="p-2 hover:bg-amber-500 rounded-xl backdrop-blur-md transition-all"
                    :class="book.pinned ? 'bg-amber-500/40 text-amber-300' : 'bg-white/10 text-white/60 hover:text-white'" :title="book.pinned ? '取消置顶' : '置顶'">
              <span class="text-sm">📌</span>
            </button>
            <button @click.stop="setCover(book.id)" class="p-2 bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl backdrop-blur-md transition-all" title="设置封面">
              <span class="text-sm">🖼️</span>
            </button>
            <button v-if="book.cover_path" @click.stop="removeCover(book.id)" class="p-2 bg-slate-500/20 hover:bg-slate-500 text-slate-400 hover:text-white rounded-xl backdrop-blur-md transition-all" title="取消封面">
              <span class="text-sm">✕</span>
            </button>
            <button @click.stop="deleteBook(book.id)" class="p-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-xl backdrop-blur-md transition-all" title="删除">
              <span class="text-sm">🗑️</span>
            </button>
          </div>
        </div>

        <div class="mt-4 px-1">
          <h3 class="font-bold text-slate-100 truncate group-hover:text-blue-400 transition-colors duration-300">{{ book.title }}</h3>
          <div class="flex items-center justify-between mt-1">
            <p v-if="book.author" class="text-xs text-slate-400 truncate max-w-[70%]">{{ book.author }}</p>
            <p class="text-[10px] text-slate-500 font-mono">{{ formatDate(book.last_read) }}</p>
          </div>
        </div>
      </div>

      <div @click="addBook" class="aspect-[3/4.2] glass-card rounded-2xl flex flex-col items-center justify-center gap-3 border-dashed border-2 border-white/5 opacity-50 hover:opacity-100 transition-all cursor-pointer hover:border-blue-500/30">
        <span class="text-3xl">+</span>
        <span class="text-sm font-medium text-slate-400">添加书籍</span>
      </div>
    </div>
  </div>
</template>
