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
  (e: 'go-back'): void
}>()

const book = ref<Book | null>(null)
const chapters = ref<Chapter[]>([])
const currentChapterIndex = ref(0)
const loading = ref(true)
const showMenu = ref(false)
const showStyling = ref(false)
const showToc = ref(false)
const isImmersive = ref(false)
const chapterFading = ref(false)
const bgImage = ref('')

// Reader styling
const fontSize = ref(20)
const lineHeight = ref(1.8)
const letterSpacing = ref(0)
const marginX = ref(60)
const marginY = ref(40)
const fontFamily = ref('system-ui')
const fontColor = ref('#e2e8f0')
const systemFonts = ref<string[]>([])

// Pagination
const currentPage = ref(0)
const totalPages = ref(1)
const contentRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// ---- Data fetching ----
const fetchBook = async () => {
  try {
    const result = await window.electronAPI.db.query(
      'SELECT * FROM books WHERE id = ?',
      [props.bookId]
    )
    if (Array.isArray(result) && result.length > 0) {
      book.value = result[0] as Book
      currentChapterIndex.value = book.value.progress_index || 0
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
      result.forEach((s: any) => {
        if (s.key === 'reader_fontSize') fontSize.value = parseInt(s.value) || 20
        if (s.key === 'reader_lineHeight') lineHeight.value = parseFloat(s.value) || 1.8
        if (s.key === 'reader_letterSpacing') letterSpacing.value = parseFloat(s.value) || 0
        if (s.key === 'reader_marginX') marginX.value = parseInt(s.value) || 60
        if (s.key === 'reader_marginY') marginY.value = parseInt(s.value) || 40
        if (s.key === 'reader_fontFamily') fontFamily.value = s.value || 'system-ui'
        if (s.key === 'reader_fontColor') fontColor.value = s.value || '#e2e8f0'
        if (s.key === 'bgImage') bgImage.value = s.value || ''
      })
    }
    try {
      systemFonts.value = await window.electronAPI.font.getSystemFonts()
    } catch (_) {
      systemFonts.value = []
    }
  } catch (e) {
    console.error('Failed to load reader settings:', e)
  }
}

// ---- Settings persistence ----
const saveSetting = async (key: string, value: any) => {
  await window.electronAPI.db.query(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, String(value)]
  )
}

const updateStyling = () => {
  saveSetting('reader_fontSize', fontSize.value)
  saveSetting('reader_lineHeight', lineHeight.value)
  saveSetting('reader_letterSpacing', letterSpacing.value)
  saveSetting('reader_marginX', marginX.value)
  saveSetting('reader_marginY', marginY.value)
  saveSetting('reader_fontFamily', fontFamily.value)
  saveSetting('reader_fontColor', fontColor.value)
  recalc()
}

// ---- Pagination ----
const recalc = () => {
  nextTick(() => {
    setTimeout(() => {
      calculatePages()
    }, 50)
  })
}

const calculatePages = () => {
  if (!contentRef.value || !containerRef.value) return
  const containerW = containerRef.value.clientWidth
  if (containerW <= 0) return
  const scrollW = contentRef.value.scrollWidth
  const pages = Math.max(1, Math.ceil(scrollW / containerW))
  totalPages.value = pages
  if (currentPage.value >= pages) {
    currentPage.value = pages - 1
  }
}

const pageOffset = computed(() => {
  if (!containerRef.value) return '0px'
  const w = containerRef.value.clientWidth
  return `-${currentPage.value * w}px`
})

// ---- Progress & Navigation ----
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

// Smooth chapter switch with fade
const switchChapter = (index: number, goToLastPage = false) => {
  if (index < 0 || index >= chapters.value.length) return
  chapterFading.value = true
  setTimeout(() => {
    currentChapterIndex.value = index
    currentPage.value = 0
    saveProgress()
    nextTick(() => {
      setTimeout(() => {
        calculatePages()
        if (goToLastPage) {
          currentPage.value = Math.max(0, totalPages.value - 1)
        }
        chapterFading.value = false
      }, 60)
    })
  }, 200) // fade-out duration
}

const goToChapter = (index: number, keepMenu = false) => {
  if (index >= 0 && index < chapters.value.length) {
    if (!keepMenu) {
      showMenu.value = false
      showStyling.value = false
      showToc.value = false
    }
    switchChapter(index)
  }
}

const nextChapter = () => {
  if (currentChapterIndex.value < chapters.value.length - 1) {
    switchChapter(currentChapterIndex.value + 1)
  }
}
const prevChapter = () => {
  if (currentChapterIndex.value > 0) {
    switchChapter(currentChapterIndex.value - 1)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++
  } else if (currentChapterIndex.value < chapters.value.length - 1) {
    switchChapter(currentChapterIndex.value + 1)
  }
}

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--
  } else if (currentChapterIndex.value > 0) {
    switchChapter(currentChapterIndex.value - 1, true)
  }
}

// ---- Interaction ----
const handleInteraction = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.menu-panel') || target.closest('.styling-panel') || target.closest('.toc-panel')) return

  if (showMenu.value) {
    // Click blank area to close menu
    showMenu.value = false
    showStyling.value = false
    showToc.value = false
    return
  }

  const x = e.clientX
  const width = window.innerWidth
  if (x < width * 0.3) {
    prevPage()
  } else if (x > width * 0.7) {
    nextPage()
  } else {
    showMenu.value = true
  }
}

const handleWheel = (e: WheelEvent) => {
  if (showMenu.value) return
  if (Math.abs(e.deltaY) < 10) return
  if (e.deltaY > 0) nextPage()
  else prevPage()
}

const toggleImmersiveMode = () => {
  isImmersive.value = !isImmersive.value
  emit('toggle-immersive', isImmersive.value)
}

const handleGoBack = () => {
  showMenu.value = false
  emit('go-back')
}

// ---- Progress ----
const progressPercent = computed(() => {
  if (chapters.value.length === 0) return 0
  const chapterWeight = 100 / chapters.value.length
  const inChapter = totalPages.value > 0
    ? ((currentPage.value + 1) / totalPages.value) * chapterWeight
    : chapterWeight
  return Math.min(100, Math.round(currentChapterIndex.value * chapterWeight + inChapter))
})

const handleProgressSlider = (e: Event) => {
  const target = e.target as HTMLInputElement
  const percent = parseInt(target.value)
  const idx = Math.floor((percent / 100) * chapters.value.length)
  goToChapter(Math.min(idx, chapters.value.length - 1), true)
}

// ---- Background style ----
const readerBgStyle = computed(() => {
  if (!bgImage.value) return {}
  return {
    backgroundImage: `url('${bgImage.value}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }
})

// ---- Watchers ----
watch(currentChapterIndex, () => {
  recalc()
})

watch([fontSize, lineHeight, letterSpacing, marginX, marginY, fontFamily], () => {
  recalc()
})

// ---- Lifecycle ----
onMounted(async () => {
  await loadSettings()
  await fetchBook()
  await fetchChapters()
  loading.value = false
  setTimeout(() => {
    calculatePages()
  }, 300)
  window.addEventListener('resize', recalc)
})

onUnmounted(() => {
  window.removeEventListener('resize', recalc)
})
</script>

<template>
  <div class="reader-root" :style="readerBgStyle" @wheel.prevent="handleWheel">
    <!-- BG overlay -->
    <div v-if="bgImage" class="bg-overlay"></div>

    <!-- Loading -->
    <div v-if="loading" class="loading-screen">
      <div class="spinner"></div>
      <p>正在载入...</p>
    </div>

    <template v-else>
      <!-- Reading Area -->
      <div class="reading-area" @click="handleInteraction">
        <div
          ref="containerRef"
          class="page-container"
          :style="{ padding: `${marginY}px ${marginX}px` }"
        >
          <div
            ref="contentRef"
            class="page-content"
            :class="{ 'chapter-fade': chapterFading }"
            :style="{
              transform: `translateX(${pageOffset})`,
              columnWidth: `calc(100vw - ${marginX * 2}px)`,
              columnGap: `${marginX * 2}px`,
              columnFill: 'auto',
              fontFamily: fontFamily,
              fontSize: fontSize + 'px',
              lineHeight: String(lineHeight),
              letterSpacing: letterSpacing + 'em',
              color: fontColor,
            }"
          >
            <h2 class="chapter-title" :style="{ fontSize: (fontSize * 1.4) + 'px', color: fontColor }">
              {{ chapters[currentChapterIndex]?.title }}
            </h2>
            <div v-html="chapters[currentChapterIndex]?.body" class="chapter-body"></div>
          </div>
        </div>
      </div>

      <!-- HUD (when menu closed) -->
      <div v-if="!showMenu" class="hud">
        <span class="hud-left">
          {{ currentPage === 0 ? book?.title : chapters[currentChapterIndex]?.title }}
        </span>
        <span class="hud-right">{{ progressPercent }}%</span>
      </div>

      <!-- ===== MENU OVERLAY ===== -->
      <Transition name="slide-fade">
        <div v-if="showMenu" class="menu-panel" @click.self="showMenu = false; showStyling = false; showToc = false">
          <!-- Top bar -->
          <div class="menu-top" @click.stop>
            <button @click="handleGoBack" class="back-btn" title="返回书架">← 书架</button>
            <div class="menu-title">{{ book?.title }}</div>
            <div class="menu-actions">
              <button @click="toggleImmersiveMode" class="menu-btn">
                {{ isImmersive ? '退出全屏' : '全屏模式' }}
              </button>
              <button
                @click="showToc = !showToc; if(showToc) showStyling = false"
                class="menu-btn"
                :class="{ active: showToc }"
              >
                ☰ 目录
              </button>
              <button
                @click="showStyling = !showStyling; if(showStyling) showToc = false"
                class="menu-btn"
                :class="{ active: showStyling }"
              >
                Aa 排版
              </button>
            </div>
          </div>

          <!-- Bottom bar: progress -->
          <div class="menu-bottom" @click.stop>
            <button @click="prevChapter" :disabled="currentChapterIndex === 0" class="ch-btn">⏮ 上一章</button>

            <div class="progress-wrap">
              <input
                type="range" min="0" max="100"
                :value="progressPercent"
                @input="handleProgressSlider"
                class="progress-slider"
              >
              <div class="progress-label">{{ progressPercent }}%</div>
            </div>

            <button @click="nextChapter" :disabled="currentChapterIndex >= chapters.length - 1" class="ch-btn">下一章 ⏭</button>
          </div>

          <div class="menu-info" @click.stop>
            <span>第 {{ currentChapterIndex + 1 }} / {{ chapters.length }} 章</span>
            <span>「{{ chapters[currentChapterIndex]?.title }}」</span>
            <span>第 {{ currentPage + 1 }} / {{ totalPages }} 页</span>
          </div>
        </div>
      </Transition>

      <!-- ===== TOC PANEL ===== -->
      <Transition name="slide-fade">
        <div v-if="showToc && showMenu" class="toc-panel" @click.stop>
          <div class="sp-header">
            <span class="sp-title">目录</span>
            <button @click="showToc = false" class="sp-close">✕</button>
          </div>
          <div class="toc-list">
            <button
              v-for="(ch, idx) in chapters"
              :key="ch.id"
              @click="goToChapter(idx, true)"
              class="toc-item"
              :class="{ 'toc-active': idx === currentChapterIndex }"
            >
              <span class="toc-idx">{{ idx + 1 }}</span>
              <span class="toc-name">{{ ch.title }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- ===== STYLING PANEL ===== -->
      <Transition name="slide-fade">
        <div v-if="showStyling && showMenu" class="styling-panel" @click.stop>
          <div class="sp-header">
            <span class="sp-title">排版设置</span>
            <button @click="showStyling = false" class="sp-close">✕</button>
          </div>

          <!-- Font family -->
          <div class="sp-row">
            <label>字体</label>
            <select v-model="fontFamily" @change="updateStyling" class="sp-select">
              <option value="system-ui">系统默认</option>
              <option value="serif">宋体 Serif</option>
              <option value="'Microsoft YaHei'">微软雅黑</option>
              <option v-for="f in systemFonts" :key="f" :value="`'${f}'`">{{ f }}</option>
            </select>
          </div>

          <!-- Font color -->
          <div class="sp-row">
            <label>字色</label>
            <input type="color" v-model="fontColor" @input="updateStyling" class="sp-color">
            <input type="text" v-model="fontColor" @change="updateStyling" class="sp-num" style="width:72px">
          </div>

          <!-- Font size -->
          <div class="sp-row">
            <label>字号</label>
            <input type="range" min="12" max="64" step="1" v-model.number="fontSize" @input="updateStyling" class="sp-slider">
            <input type="number" v-model.number="fontSize" @change="updateStyling" class="sp-num">
            <span class="sp-unit">px</span>
          </div>

          <!-- Line height -->
          <div class="sp-row">
            <label>行间距</label>
            <input type="range" min="1" max="4" step="0.1" v-model.number="lineHeight" @input="updateStyling" class="sp-slider">
            <input type="number" v-model.number="lineHeight" step="0.1" @change="updateStyling" class="sp-num">
          </div>

          <!-- Letter spacing -->
          <div class="sp-row">
            <label>字间距</label>
            <input type="range" min="-0.1" max="1" step="0.01" v-model.number="letterSpacing" @input="updateStyling" class="sp-slider">
            <input type="number" v-model.number="letterSpacing" step="0.01" @change="updateStyling" class="sp-num">
            <span class="sp-unit">em</span>
          </div>

          <!-- Margin X -->
          <div class="sp-row">
            <label>左右边距</label>
            <input type="range" min="0" max="200" step="1" v-model.number="marginX" @input="updateStyling" class="sp-slider">
            <input type="number" v-model.number="marginX" @change="updateStyling" class="sp-num">
            <span class="sp-unit">px</span>
          </div>

          <!-- Margin Y -->
          <div class="sp-row">
            <label>上下边距</label>
            <input type="range" min="0" max="150" step="1" v-model.number="marginY" @input="updateStyling" class="sp-slider">
            <input type="number" v-model.number="marginY" @change="updateStyling" class="sp-num">
            <span class="sp-unit">px</span>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.reader-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
  color: white;
  background: #0f172a;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  pointer-events: none;
  z-index: 0;
}

.loading-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255,255,255,0.5);
  z-index: 1;
}
.spinner {
  width: 40px; height: 40px;
  border: 2px solid rgba(59,130,246,0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.reading-area {
  flex: 1;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  z-index: 1;
}

.page-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.page-content {
  height: 100%;
  transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease;
  column-fill: auto;
  opacity: 1;
}

.page-content.chapter-fade {
  opacity: 0;
}

.chapter-title {
  font-weight: 700;
  margin-bottom: 1.5em;
  opacity: 0.85;
}

.chapter-body { height: 100%; }
.chapter-body :deep(p) {
  text-indent: 2em;
  margin-bottom: 0.8em;
}

/* ---- HUD ---- */
.hud {
  position: absolute;
  bottom: 16px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  z-index: 10;
}
.hud-left, .hud-right {
  font-size: 11px;
  font-weight: 600;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(8px);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.06);
  opacity: 0.7;
}
.hud-right { font-family: 'Consolas', monospace; }

/* ---- Menu Panel ---- */
.menu-panel {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.menu-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  height: 52px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.back-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.15);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 10px;
  transition: all 0.2s;
  white-space: nowrap;
}
.back-btn:hover { background: rgba(255,255,255,0.1); }
.menu-title {
  font-weight: 700;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 30%;
  opacity: 0.8;
}
.menu-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.menu-btn {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}
.menu-btn:hover { background: rgba(59,130,246,0.2); }
.menu-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}

.menu-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.ch-btn {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.ch-btn:hover:not(:disabled) { background: rgba(59,130,246,0.2); }
.ch-btn:disabled { opacity: 0.25; cursor: default; }

.progress-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.progress-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}
.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  background: white;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.progress-label {
  font-size: 10px;
  font-family: monospace;
  color: rgba(255,255,255,0.5);
}

.menu-info {
  display: flex;
  justify-content: space-between;
  padding: 0 24px 10px;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  font-weight: 600;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
}

/* ---- TOC Panel ---- */
.toc-panel {
  position: absolute;
  left: 20px;
  top: 60px;
  bottom: 120px;
  width: 300px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 16px;
  z-index: 60;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
}
.toc-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toc-list::-webkit-scrollbar { width: 4px; }
.toc-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.toc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.toc-item:hover { background: rgba(255,255,255,0.06); color: white; }
.toc-active {
  background: rgba(59,130,246,0.15) !important;
  color: #60a5fa !important;
  font-weight: 700;
}
.toc-idx {
  font-size: 10px;
  opacity: 0.4;
  min-width: 24px;
  font-family: monospace;
}
.toc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Styling Panel ---- */
.styling-panel {
  position: absolute;
  right: 20px;
  top: 60px;
  bottom: 120px;
  width: 340px;
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 20px;
  z-index: 60;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.sp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.sp-title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  opacity: 0.5;
}
.sp-close {
  background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 16px;
}
.sp-close:hover { color: white; }

.sp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.sp-row label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
  min-width: 56px;
  flex-shrink: 0;
}
.sp-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  outline: none;
}
.sp-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  background: white;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}
.sp-num {
  width: 52px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 4px 6px;
  text-align: center;
  font-size: 12px;
  font-family: monospace;
  color: white;
  outline: none;
}
.sp-num:focus { border-color: #3b82f6; }
.sp-unit {
  font-size: 10px;
  opacity: 0.3;
  font-family: monospace;
  min-width: 20px;
}
.sp-select {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: white;
  outline: none;
  cursor: pointer;
}
.sp-select option { background: #0f172a; color: white; }
.sp-color {
  width: 36px;
  height: 30px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  padding: 2px;
}

/* ---- Transitions ---- */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from { opacity: 0; transform: translateY(12px); }
.slide-fade-leave-to { opacity: 0; transform: translateY(12px); }
</style>
