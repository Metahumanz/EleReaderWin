<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'

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

const emit = defineEmits<{
  (e: 'toggle-immersive', isFull: boolean): void
}>()

const book = ref<Book | null>(null)
const chapters = ref<Chapter[]>([])
const currentChapterIndex = ref(0)
const loading = ref(true)
const showMenu = ref(false)
const showStyling = ref(false)
const isImmersive = ref(false)

// Reader Settings
const fontSize = ref(20)
const lineHeight = ref(1.8)
const letterSpacing = ref(0)
const marginX = ref(60)
const marginY = ref(40)
const fontFamily = ref('system-ui')
const systemFonts = ref<string[]>([])

// Pagination
const currentPage = ref(0)
const totalPages = ref(1)
const contentRef = ref<HTMLElement | null>(null)

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

const loadSettings = async () => {
  try {
    const result = await window.electronAPI.db.query('SELECT * FROM settings')
    if (Array.isArray(result)) {
      result.forEach(s => {
        if (s.key === 'reader_fontSize') fontSize.value = parseInt(s.value)
        if (s.key === 'reader_lineHeight') lineHeight.value = parseFloat(s.value)
        if (s.key === 'reader_letterSpacing') letterSpacing.value = parseFloat(s.value)
        if (s.key === 'reader_marginX') marginX.value = parseInt(s.value)
        if (s.key === 'reader_marginY') marginY.value = parseInt(s.value)
        if (s.key === 'reader_fontFamily') fontFamily.value = s.value
      })
    }
    systemFonts.value = await window.electronAPI.font.getSystemFonts()
  } catch (e) {
    console.error('Failed to load reader settings:', e)
  }
}

const saveSetting = async (key: string, value: any) => {
  await window.electronAPI.db.query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)])
}

const updateStyling = () => {
  saveSetting('reader_fontSize', fontSize.value)
  saveSetting('reader_lineHeight', lineHeight.value)
  saveSetting('reader_letterSpacing', letterSpacing.value)
  saveSetting('reader_marginX', marginX.value)
  saveSetting('reader_marginY', marginY.value)
  saveSetting('reader_fontFamily', fontFamily.value)
  calculatePages()
}

const calculatePages = () => {
  if (!contentRef.value) return
  // Small delay to allow reflow
  setTimeout(() => {
    if (!contentRef.value) return
    const scrollWidth = contentRef.value.scrollWidth
    const clientWidth = contentRef.value.clientWidth
    totalPages.value = Math.max(1, Math.ceil(scrollWidth / clientWidth))
    if (currentPage.value >= totalPages.value) {
      currentPage.value = totalPages.value - 1
    }
  }, 100)
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
    currentPage.value = 0
    showMenu.value = false
    saveProgress()
    calculatePages()
  }
}

const nextChapter = () => goToChapter(currentChapterIndex.value + 1)
const prevChapter = () => goToChapter(currentChapterIndex.value - 1)

const nextPage = () => {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++
  } else if (currentChapterIndex.value < chapters.value.length - 1) {
    nextChapter()
  }
}

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--
  } else if (currentChapterIndex.value > 0) {
    prevChapter()
    // Go to last page of prev chapter
    setTimeout(() => {
      currentPage.value = totalPages.value - 1
    }, 150)
  }
}

const handleInteraction = (e: MouseEvent) => {
  const x = e.clientX
  const width = window.innerWidth
  const leftZone = width * 0.3
  const rightZone = width * 0.7

  if (x < leftZone) {
    prevPage()
  } else if (x > rightZone) {
    nextPage()
  } else {
    showMenu.value = !showMenu.value
    if (!showMenu.value) showStyling.value = false
  }
}

const handleWheel = (e: WheelEvent) => {
  if (Math.abs(e.deltaY) < 10) return
  if (e.deltaY > 0) nextPage()
  else prevPage()
}

const toggleImmersiveMode = () => {
  isImmersive.value = !isImmersive.value
  emit('toggle-immersive', isImmersive.value)
}

const progressPercent = computed(() => {
  if (chapters.value.length === 0) return 0
  const chapterWeight = 100 / chapters.value.length
  const currentChapterProgress = (currentPage.value + 1) / totalPages.value * chapterWeight
  return Math.min(100, Math.round(currentChapterIndex.value * chapterWeight + currentChapterProgress))
})

const handleSliderChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const percent = parseInt(target.value)
  const index = Math.floor((percent / 100) * chapters.value.length)
  goToChapter(Math.min(index, chapters.value.length - 1))
}

watch([currentChapterIndex, fontSize, lineHeight, fontFamily, marginX, marginY], () => {
  calculatePages()
})

onMounted(async () => {
  await loadSettings()
  await fetchBook()
  await fetchChapters()
  loading.value = false
  calculatePages()
  window.addEventListener('resize', calculatePages)
})

onUnmounted(() => {
  window.removeEventListener('resize', calculatePages)
})
</script>

<template>
  <div class="fixed inset-0 overflow-hidden select-none flex flex-col font-sans transition-all duration-500" @wheel="handleWheel">
    <div v-if="loading" class="flex-1 flex items-center justify-center glass-dark">
      <div class="flex flex-col items-center gap-4">
        <div class="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <p class="text-slate-400 font-medium tracking-widest">正在载入文墨...</p>
      </div>
    </div>

    <template v-else>
      <!-- Content Layer -->
      <div 
        class="flex-1 relative cursor-pointer active:scale-[0.995] transition-transform duration-300"
        @click="handleInteraction"
      >
        <div 
          ref="contentRef"
          class="h-full px-[var(--mx)] py-[var(--my)]"
          :style="{
            '--mx': marginX + 'px',
            '--my': marginY + 'px',
            columnWidth: '100vw',
            columnGap: 'calc(var(--mx) * 2)',
            columnFill: 'auto'
          }"
        >
          <div 
            class="h-full transition-transform duration-500 ease-out"
            :style="{ 
              transform: `translateX(calc(-1 * ${currentPage} * (100vw)))`,
              fontFamily: fontFamily,
              fontSize: fontSize + 'px',
              lineHeight: lineHeight,
              letterSpacing: letterSpacing + 'em',
            }"
          >
            <div class="prose prose-invert max-w-none prose-p:mb-[0.8em]">
              <h2 class="text-3xl font-bold mb-8 opacity-80" :style="{ fontSize: (fontSize * 1.5) + 'px' }">
                {{ chapters[currentChapterIndex]?.title }}
              </h2>
              <div v-html="chapters[currentChapterIndex]?.body"></div>
            </div>
          </div>
        </div>

        <!-- HUD: Bottom overlays when menu is hidden -->
        <Transition name="fade">
          <div v-if="!showMenu" class="absolute bottom-6 left-10 right-10 flex justify-between items-end pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity">
            <div class="text-xs font-medium">
              {{ currentPage === 0 ? book?.title : chapters[currentChapterIndex]?.title }}
            </div>
            <div class="text-xs font-mono">
              {{ progressPercent }}%
            </div>
          </div>
        </Transition>
      </div>

      <!-- Menu Overlay -->
      <Transition name="fade">
        <div v-if="showMenu" class="absolute inset-x-0 top-0 h-16 glass-dark border-b border-white/5 flex items-center px-6 z-50">
          <button @click="showMenu = false" class="p-2 hover:bg-white/10 rounded-xl transition-all">
            <span class="text-xl">✕</span>
          </button>
          <div class="ml-4 font-bold truncate max-w-[40%] opacity-80">{{ book?.title }}</div>
          
          <div class="ml-auto flex items-center gap-3">
            <button 
              @click="toggleImmersiveMode" 
              class="px-3 py-1.5 glass rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all border-none"
            >
              {{ isImmersive ? '退出沉浸' : '沉浸模式' }}
            </button>
            <button 
              @click="showStyling = !showStyling" 
              class="p-2.5 hover:bg-white/10 rounded-xl transition-all"
              :class="{ 'bg-blue-500/20 text-blue-400': showStyling }"
            >
              <span>Aa</span>
            </button>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showMenu" class="absolute inset-x-0 bottom-0 py-6 px-10 glass-dark border-t border-white/5 z-50">
          <div class="max-w-4xl mx-auto space-y-6">
            <!-- Progress Slider -->
            <div class="flex items-center gap-6">
              <button 
                @click="prevChapter" 
                :disabled="currentChapterIndex === 0"
                class="p-3 glass rounded-2xl disabled:opacity-30 hover:bg-white/10"
              >
                ⏮️
              </button>
              
              <div class="flex-1 relative group">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  :value="progressPercent"
                  @change="handleSliderChange"
                  class="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                >
                <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {{ progressPercent }}%
                </div>
              </div>

              <button 
                @click="nextChapter" 
                :disabled="currentChapterIndex === chapters.length - 1"
                class="p-3 glass rounded-2xl disabled:opacity-30 hover:bg-white/10"
              >
                ⏭️
              </button>
            </div>

            <div class="flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>第 {{ currentChapterIndex + 1 }} 章 : {{ chapters[currentChapterIndex]?.title }}</span>
              <span>{{ currentPage + 1 }} / {{ totalPages }} 页</span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Advanced Styling Panel -->
      <Transition name="fade">
        <div v-if="showStyling && showMenu" class="absolute right-6 bottom-32 w-80 glass-dark rounded-3xl p-6 border border-white/10 z-[60] shadow-2xl">
          <h3 class="text-sm font-bold mb-6 opacity-60 uppercase tracking-widest">排版设置</h3>
          
          <div class="space-y-6">
            <!-- Font Family -->
            <div>
              <label class="text-[10px] opacity-40 block mb-2 font-bold">字体库</label>
              <select 
                v-model="fontFamily" 
                @change="updateStyling"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/50"
              >
                <option value="system-ui">系统默认 (Sans)</option>
                <option value="serif">宋体 / Serif</option>
                <option v-for="f in systemFonts" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>

            <!-- Font Size -->
            <div class="flex items-center justify-between gap-4">
              <span class="text-xs opacity-60">字号</span>
              <div class="flex items-center gap-3">
                <button @click="fontSize > 12 && (fontSize--, updateStyling())" class="w-8 h-8 glass rounded-lg">-</button>
                <span class="w-8 text-center text-sm font-mono">{{ fontSize }}</span>
                <button @click="fontSize < 48 && (fontSize++, updateStyling())" class="w-8 h-8 glass rounded-lg">+</button>
              </div>
            </div>

            <!-- Line Height -->
            <div class="flex items-center justify-between gap-4">
              <span class="text-xs opacity-60">行间距</span>
              <div class="flex items-center gap-3">
                <button @click="lineHeight > 1 && (lineHeight -= 0.1, updateStyling())" class="w-8 h-8 glass rounded-lg">-</button>
                <span class="w-8 text-center text-sm font-mono">{{ lineHeight.toFixed(1) }}</span>
                <button @click="lineHeight < 4 && (lineHeight += 0.1, updateStyling())" class="w-8 h-8 glass rounded-lg">+</button>
              </div>
            </div>

            <!-- Letter Spacing -->
            <div class="flex items-center justify-between gap-4">
              <span class="text-xs opacity-60">字间距</span>
              <div class="flex items-center gap-3">
                <button @click="letterSpacing > -0.1 && (letterSpacing -= 0.05, updateStyling())" class="w-8 h-8 glass rounded-lg">-</button>
                <span class="w-8 text-center text-sm font-mono">{{ letterSpacing.toFixed(2) }}</span>
                <button @click="letterSpacing < 1 && (letterSpacing += 0.05, updateStyling())" class="w-8 h-8 glass rounded-lg">+</button>
              </div>
            </div>

            <!-- Margins -->
            <div class="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <label class="text-[10px] opacity-40 block mb-1 font-bold">左右边距</label>
                <input type="number" v-model.number="marginX" @change="updateStyling" class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm outline-none">
              </div>
              <div>
                <label class="text-[10px] opacity-40 block mb-1 font-bold">上下边距</label>
                <input type="number" v-model.number="marginY" @change="updateStyling" class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm outline-none">
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.prose {
  height: calc(100vh - var(--my) * 2);
}

/* Page Indicator Dots */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  @apply w-4 h-4 bg-white rounded-full shadow-lg border-2 border-blue-500 cursor-pointer;
}

select option {
  @apply bg-slate-900 text-white;
}

.fade-element {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
