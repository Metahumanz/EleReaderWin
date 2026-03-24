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
  <div class="pt-6">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-[22px] font-semibold text-white/90 tracking-wide">我的书架</h2>
        <p class="text-white/50 text-[13px] mt-1">共 {{ books.length }} 本书籍</p>
      </div>
      <button @click="addBook" :disabled="importing"
        class="group px-5 py-2 min-w-[120px] bg-[#005fb8] hover:bg-[#005fb8]/90 disabled:bg-white/5 disabled:text-white/30 rounded-md transition-colors flex justify-center items-center gap-2 shadow-sm font-medium border border-black/20">
        <span class="text-xl leading-none">{{ importing ? '⏳' : '+' }}</span>
        <span class="text-[14px]">{{ importing ? '正在导入...' : '添加书籍' }}</span>
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-4">
      <div class="w-10 h-10 border-4 border-[#005fb8]/30 border-t-[#005fb8] rounded-full animate-spin"></div>
      <p class="text-white/50 text-sm animate-pulse">正在获取书籍...</p>
    </div>

    <div v-else-if="books.length === 0" class="text-center py-28 bg-[#2d2d2d] rounded-xl border border-white/5 mx-auto max-w-lg shadow-sm">
      <div class="text-5xl mb-6 opacity-60">📚</div>
      <p class="text-lg text-white/80 font-medium mb-3">书架空空如也</p>
      <p class="text-[13px] text-white/40 mb-8">支持 TXT 和 EPUB 格式的本地解析与无缝阅读</p>
      <button @click="addBook" class="px-8 py-2.5 bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/10 text-[14px] font-medium">开启阅读之旅</button>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pb-10">
      <div v-for="(book, index) in books" :key="book.id" class="relative group cursor-pointer bookshelf-card" 
           :style="{ animationDelay: `${index * 30}ms` }" @click="emit('open-book', book.id)">
        <div class="aspect-[3/4.2] bg-[#2d2d2d] rounded-xl overflow-hidden relative shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-white/[0.08] hover:border-white/[0.15]"
             :class="{'ring-1 ring-[#005fb8]': book.pinned}">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111111]/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>

          <!-- Pin badge -->
          <div v-if="book.pinned" class="absolute top-2 left-2 z-20 text-white text-[10px] font-bold bg-[#005fb8]/90 backdrop-blur-md rounded px-1.5 py-0.5 border border-[#005fb8]">置顶</div>

          <!-- Cover image or default icon -->
          <img v-if="book.cover_path" :src="book.cover_path" class="w-full h-full object-cover rounded-xl" alt="封面" @error="(e: Event) => (e.target as HTMLImageElement).style.display='none'" />
          <div v-else class="h-full w-full flex items-center justify-center opacity-70">
            <span class="text-5xl group-hover:scale-105 transition-transform duration-500">📖</span>
          </div>

          <!-- Actions -->
          <div class="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
            <button @click.stop="togglePin(book)" class="p-1.5 rounded-md backdrop-blur-md transition-colors border border-transparent hover:border-white/10"
                    :class="book.pinned ? 'bg-[#005fb8]/80 text-white' : 'bg-black/50 text-white/70 hover:bg-black/80 hover:text-white'" :title="book.pinned ? '取消置顶' : '置顶'">
              <span class="text-sm">📌</span>
            </button>
            <button @click.stop="setCover(book.id)" class="p-1.5 bg-black/50 hover:bg-black/80 text-white/70 hover:text-white rounded-md backdrop-blur-md transition-colors border border-transparent hover:border-white/10" title="设置封面">
              <span class="text-sm">🖼️</span>
            </button>
            <button v-if="book.cover_path" @click.stop="removeCover(book.id)" class="p-1.5 bg-black/50 hover:bg-black/80 text-white/70 hover:text-white rounded-md backdrop-blur-md transition-colors border border-transparent hover:border-white/10" title="取消封面">
              <span class="text-sm">✕</span>
            </button>
            <button @click.stop="deleteBook(book.id)" class="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-md backdrop-blur-md transition-colors border border-transparent hover:border-red-500/50 shadow-sm" title="删除">
              <span class="text-sm">🗑️</span>
            </button>
          </div>
        </div>

        <div class="mt-3 px-1">
          <h3 class="font-semibold text-[14px] text-white/90 truncate group-hover:text-[#005fb8] transition-colors duration-200">{{ book.title }}</h3>
          <div class="flex items-center justify-between mt-0.5">
            <p v-if="book.author" class="text-[12px] text-white/50 truncate max-w-[65%]">{{ book.author }}</p>
            <p class="text-[10px] text-white/30 font-mono">{{ formatDate(book.last_read) }}</p>
          </div>
        </div>
      </div>

      <div @click="addBook" class="aspect-[3/4.2] bg-[#2d2d2d]/50 rounded-xl flex flex-col items-center justify-center gap-3 border-dashed border-2 border-white/10 opacity-60 hover:opacity-100 transition-all cursor-pointer hover:border-white/30 hover:bg-[#2d2d2d]">
        <span class="text-3xl font-light">+</span>
        <span class="text-[13px] font-medium text-white/60">添加书籍</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bookshelf-card {
  opacity: 0;
  transform: translateY(20px);
  animation: cardFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes cardFadeIn {
  to { opacity: 1; transform: translateY(0); }
}
</style>
