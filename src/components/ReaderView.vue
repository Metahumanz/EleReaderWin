<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted, nextTick } from 'vue'

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
const containerRef = ref<HTMLElement | null>(null)

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
        if (s.key === 'reader_fontSize') fontSize.value = parseInt(s.value) || 20
        if (s.key === 'reader_lineHeight') lineHeight.value = parseFloat(s.value) || 1.8
        if (s.key === 'reader_letterSpacing') letterSpacing.value = parseFloat(s.value) || 0
        if (s.key === 'reader_marginX') marginX.value = parseInt(s.value) || 60
        if (s.key === 'reader_marginY') marginY.value = parseInt(s.value) || 40
        if (s.key === 'reader_fontFamily') fontFamily.value = s.value || 'system-ui'
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
  if (!contentRef.value || !containerRef.value) return
  nextTick(() => {
    const scrollWidth = contentRef.value!.scrollWidth
    const clientWidth = containerRef.value!.clientWidth
    totalPages.value = Math.max(1, Math.ceil(scrollWidth / clientWidth))
    if (currentPage.value >= totalPages.value) {
      currentPage.value = totalPages.value - 1
    }
  })
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
    nextTick(() => {
      currentPage.value = totalPages.value - 1
    })
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
  setTimeout(calculatePages, 200)
  window.addEventListener('resize', calculatePages)
})

onUnmounted(() => {
  window.removeEventListener('resize', calculatePages)
})
</script>

<template>
  <div class="fixed inset-0 overflow-hidden select-none flex flex-col transition-all duration-500" @wheel="handleWheel">
    <div v-if="loading" class="flex-1 flex items-center justify-center glass-dark">
      <div class="flex flex-col items-center gap-4">
        <div class="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <p class="text-slate-400 font-medium tracking-widest">正在载入文墨...</p>
      </div>
    </div>

    <template v-else>
      <!-- Content Layer -->
      <div 
        class="flex-1 relative cursor-pointer active:scale-[0.998] transition-all duration-300"
        @click="handleInteraction"
      >
        <div 
          ref="containerRef"
          class="h-full overflow-hidden"
          :style="{
            padding: `${marginY}px ${marginX}px`
          }"
        >
          <div 
            ref="contentRef"
            class="h-full transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)"
            :style="{ 
              transform: `translateX(calc(-1 * ${currentPage} * (100% + ${marginX * 2}px)))`,
              columnWidth: 'calc(100vw - ' + (marginX * 2) + 'px)',
              columnGap: (marginX * 2) + 'px',
              columnFill: 'auto',
              fontFamily: fontFamily,
              fontSize: fontSize + 'px',
              lineHeight: lineHeight,
              letterSpacing: letterSpacing + 'em',
            }"
          >
            <div class="prose prose-invert max-w-none prose-p:mb-[0.8em]">
              <h2 class="text-3xl font-bold mb-8 opacity-80" :style="{ fontSize: (fontSize * 1.6) + 'px' }">
                {{ chapters[currentChapterIndex]?.title }}
              </h2>
              <div v-html="chapters[currentChapterIndex]?.body" class="reader-content"></div>
            </div>
          </div>
        </div>

        <!-- HUD: Bottom overlays when menu is hidden -->
        <Transition name="fade">
          <div v-if="!showMenu" class="absolute bottom-6 left-12 right-12 flex justify-between items-end pointer-events-none opacity-60 transition-opacity">
            <div class="text-[11px] font-bold tracking-tight bg-slate-900/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/5">
              {{ currentPage === 0 ? book?.title : chapters[currentChapterIndex]?.title }}
            </div>
            <div class="text-[11px] font-mono font-bold bg-slate-900/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/5">
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
          <div class="ml-4 font-bold truncate max-w-[40%] text-slate-200">
            {{ book?.title }}
            <span class="ml-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/20">v0.1.2</span>
          </div>
          
          <div class="ml-auto flex items-center gap-3">
            <button 
              @click="toggleImmersiveMode" 
              class="px-4 py-1.5 glass rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all border-none"
            >
              {{ isImmersive ? '退出全屏' : '全屏模式' }}
            </button>
            <button 
              @click="showStyling = !showStyling" 
              class="p-2.5 hover:bg-white/10 rounded-xl transition-all"
              :class="{ 'bg-blue-500 text-white shadow-lg shadow-blue-500/30': showStyling }"
            >
              <span class="font-bold">Aa</span>
            </button>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showMenu" class="absolute inset-x-0 bottom-0 py-8 px-12 glass-dark border-t border-white/5 z-50">
          <div class="max-w-4xl mx-auto space-y-8">
            <!-- Progress Control -->
            <div class="flex items-center gap-8">
              <button 
                @click="prevChapter" 
                :disabled="currentChapterIndex === 0"
                class="w-12 h-12 glass rounded-2xl flex items-center justify-center disabled:opacity-20 hover:bg-blue-500/20 transition-all active:scale-90"
              >
                <span class="text-xl">⏮</span>
              </button>
              
              <div class="flex-1 relative group py-2">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  :value="progressPercent"
                  @input="handleSliderChange"
                  class="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                >
                <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 px-2 py-0.5 rounded text-white font-bold shadow-lg">
                  {{ progressPercent }}%
                </div>
              </div>

              <button 
                @click="nextChapter" 
                :disabled="currentChapterIndex === chapters.length - 1"
                class="w-12 h-12 glass rounded-2xl flex items-center justify-center disabled:opacity-20 hover:bg-blue-500/20 transition-all active:scale-90"
              >
                <span class="text-xl">⏭</span>
              </button>
            </div>

            <div class="flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-widest">
              <span class="bg-white/5 px-2 py-1 rounded">第 {{ currentChapterIndex + 1 }} 章</span>
              <span class="text-blue-400">「 {{ chapters[currentChapterIndex]?.title }} 」</span>
              <span class="bg-white/5 px-2 py-1 rounded">{{ currentPage + 1 }} / {{ totalPages }} 页</span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Advanced Styling Panel -->
      <Transition name="fade">
        <div v-if="showStyling && showMenu" class="absolute right-8 bottom-36 w-[340px] glass-dark rounded-3xl p-8 border border-white/10 z-[60] shadow-2xl space-y-8">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-black opacity-40 uppercase tracking-[0.2em]">排版实验室</h3>
            <button @click="showStyling = false" class="text-slate-500 hover:text-white transition-colors">✕</button>
          </div>
          
          <div class="space-y-7">
            <!-- Font Selection -->
            <div class="space-y-3">
              <label class="text-[10px] opacity-40 block font-black uppercase tracking-widest">字体艺术</label>
              <select 
                v-model="fontFamily" 
                @change="updateStyling"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500/50 appearance-none cursor-pointer transition-all hover:bg-white/10"
              >
                <option value="system-ui">系统默认 (Sans)</option>
                <option value="serif">宋体 / Serif</option>
                <option v-for="f in systemFonts" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>

            <!-- Stylers: Slider + Input Pair -->
            <div v-for="item in [
              { label: '文字大小', key: 'fontSize', min: 12, max: 64, step: 1, unit: 'px' },
              { label: '行间距', key: 'lineHeight', min: 1.0, max: 4.0, step: 0.1, unit: '' },
              { label: '字间距', key: 'letterSpacing', min: -0.1, max: 1.0, step: 0.01, unit: 'em' }
            ]" :key="item.key" class="space-y-3">
              <div class="flex justify-between items-center">
                <label class="text-[10px] opacity-40 font-black uppercase tracking-widest">{{ item.label }}</label>
                <div class="flex items-center gap-2">
                  <input 
                    type="number" 
                    v-model="($data as any)[item.key]" 
                    @change="updateStyling"
                    class="w-14 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-center text-xs font-mono outline-none focus:border-blue-500"
                  >
                  <span class="text-[10px] opacity-30 font-mono">{{ item.unit }}</span>
                </div>
              </div>
              <input 
                type="range" :min="item.min" :max="item.max" :step="item.step" 
                v-model.number="($data as any)[item.key]" 
                @input="updateStyling"
                class="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500"
              >
            </div>

            <!-- Margins: Slider + Input -->
            <div v-for="item in [
              { label: '左右边距', key: 'marginX', min: 0, max: 200, step: 1 },
              { label: '上下边距', key: 'marginY', min: 0, max: 150, step: 1 }
            ]" :key="item.key" class="space-y-3">
              <div class="flex justify-between items-center">
                <label class="text-[10px] opacity-40 font-black uppercase tracking-widest">{{ item.label }}</label>
                <input 
                  type="number" 
                  v-model="($data as any)[item.key]" 
                  @change="updateStyling"
                  class="w-14 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-center text-xs font-mono outline-none"
                >
              </div>
              <input 
                type="range" :min="item.min" :max="item.max" :step="item.step" 
                v-model.number="($data as any)[item.key]" 
                @input="updateStyling"
                class="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500"
              >
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.reader-content {
  height: 100%;
}

/* Range input styling */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  @apply w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-blue-500 cursor-pointer hover:scale-125 transition-transform;
}

select option {
  @apply bg-slate-900 text-white p-4;
}

.fade-element {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Custom Scrollbar (hidden but logic remains) */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
