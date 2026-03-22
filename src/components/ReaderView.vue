<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted, nextTick } from 'vue'

interface Chapter { id: number; title: string; body: string; order_index: number }
interface Book { id: number; title: string; author: string | null; path: string; progress_index: number; progress_offset: number }

const props = defineProps<{ bookId: number }>()
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
const bgImage = ref('')

// Styling
const fontSize = ref(20)
const lineHeight = ref(1.8)
const letterSpacing = ref(0)
const fontWeight = ref(400)
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

// Animation
const flipAnim = ref<'none' | 'flip-left' | 'flip-right'>('none')
const chapterFading = ref(false)
const tocListRef = ref<HTMLElement | null>(null)

// ---- Data ----
const fetchBook = async () => {
  try {
    const r = await window.electronAPI.db.query('SELECT * FROM books WHERE id = ?', [props.bookId])
    if (Array.isArray(r) && r.length > 0) {
      book.value = r[0] as Book
      currentChapterIndex.value = book.value.progress_index || 0
    }
  } catch (e) { console.error(e) }
}

const fetchChapters = async () => {
  try {
    const r = await window.electronAPI.db.query('SELECT * FROM chapters WHERE book_id = ? ORDER BY order_index', [props.bookId])
    chapters.value = r as Chapter[]
  } catch (e) { console.error(e) }
}

const loadSettings = async () => {
  try {
    const r = await window.electronAPI.db.query('SELECT * FROM settings')
    if (Array.isArray(r)) {
      r.forEach((s: any) => {
        if (s.key === 'reader_fontSize') fontSize.value = parseInt(s.value) || 20
        if (s.key === 'reader_lineHeight') lineHeight.value = parseFloat(s.value) || 1.8
        if (s.key === 'reader_letterSpacing') letterSpacing.value = parseFloat(s.value) || 0
        if (s.key === 'reader_fontWeight') fontWeight.value = parseInt(s.value) || 400
        if (s.key === 'reader_marginX') marginX.value = parseInt(s.value) || 60
        if (s.key === 'reader_marginY') marginY.value = parseInt(s.value) || 40
        if (s.key === 'reader_fontFamily') fontFamily.value = s.value || 'system-ui'
        if (s.key === 'reader_fontColor') fontColor.value = s.value || '#e2e8f0'
        if (s.key === 'bgImage') bgImage.value = s.value || ''
      })
    }
    try { systemFonts.value = await window.electronAPI.font.getSystemFonts() } catch (_) { systemFonts.value = [] }
  } catch (e) { console.error(e) }
}

const saveSetting = async (k: string, v: any) => {
  await window.electronAPI.db.query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, String(v)])
}

const updateStyling = () => {
  saveSetting('reader_fontSize', fontSize.value)
  saveSetting('reader_lineHeight', lineHeight.value)
  saveSetting('reader_letterSpacing', letterSpacing.value)
  saveSetting('reader_fontWeight', fontWeight.value)
  saveSetting('reader_marginX', marginX.value)
  saveSetting('reader_marginY', marginY.value)
  saveSetting('reader_fontFamily', fontFamily.value)
  saveSetting('reader_fontColor', fontColor.value)
  recalc()
}

// ---- Pagination ----
const recalc = () => { nextTick(() => { setTimeout(calculatePages, 60) }) }

const calculatePages = () => {
  if (!contentRef.value || !containerRef.value) return
  const cw = containerRef.value.clientWidth
  if (cw <= 0) return
  totalPages.value = Math.max(1, Math.ceil(contentRef.value.scrollWidth / cw))
  if (currentPage.value >= totalPages.value) currentPage.value = totalPages.value - 1
}

const pageOffset = computed(() => {
  if (!containerRef.value) return '0px'
  return `-${currentPage.value * containerRef.value.clientWidth}px`
})

const saveProgress = async () => {
  if (!book.value) return
  try {
    await window.electronAPI.db.query(
      'UPDATE books SET progress_index = ?, last_read = ? WHERE id = ?',
      [currentChapterIndex.value, new Date().toISOString(), props.bookId]
    )
  } catch (e) { console.error(e) }
}

// ---- Page flip with cover animation ----
let flipLock = false

const doFlip = (dir: 'flip-left' | 'flip-right', action: () => void) => {
  if (flipLock) return
  flipLock = true
  flipAnim.value = dir
  setTimeout(() => {
    action()
    nextTick(() => {
      flipAnim.value = 'none'
      flipLock = false
    })
  }, 280)
}

// Chapter crossfade
const crossfadeChapter = (newIdx: number, goToLast = false) => {
  if (newIdx < 0 || newIdx >= chapters.value.length || flipLock) return
  flipLock = true
  chapterFading.value = true
  setTimeout(() => {
    currentChapterIndex.value = newIdx
    currentPage.value = 0
    saveProgress()
    nextTick(() => {
      setTimeout(() => {
        calculatePages()
        if (goToLast) currentPage.value = Math.max(0, totalPages.value - 1)
        chapterFading.value = false
        flipLock = false
      }, 80)
    })
  }, 250)
}

const nextPage = () => {
  if (flipLock) return
  if (currentPage.value < totalPages.value - 1) {
    doFlip('flip-left', () => { currentPage.value++ })
  } else if (currentChapterIndex.value < chapters.value.length - 1) {
    crossfadeChapter(currentChapterIndex.value + 1)
  }
}

const prevPage = () => {
  if (flipLock) return
  if (currentPage.value > 0) {
    doFlip('flip-right', () => { currentPage.value-- })
  } else if (currentChapterIndex.value > 0) {
    crossfadeChapter(currentChapterIndex.value - 1, true)
  }
}

const goToChapter = (idx: number, keepMenu = false) => {
  if (idx >= 0 && idx < chapters.value.length) {
    crossfadeChapter(idx)
  }
  if (!keepMenu) closeAll()
}

// ---- Interaction ----
const closeAll = () => { showMenu.value = false; showStyling.value = false; showToc.value = false }

const handleClick = (e: MouseEvent) => {
  const t = e.target as HTMLElement
  if (t.closest('.menu-top') || t.closest('.menu-bottom') || t.closest('.menu-info') ||
      t.closest('.styling-panel') || t.closest('.toc-panel')) return

  // If menu is open, any click on blank area closes it
  if (showMenu.value) {
    closeAll()
    return
  }

  const x = e.clientX
  const w = window.innerWidth
  if (x < w * 0.3) prevPage()
  else if (x > w * 0.7) nextPage()
  else showMenu.value = true
}

const handleWheel = (e: WheelEvent) => {
  if (showMenu.value) return
  if (Math.abs(e.deltaY) < 10) return
  e.preventDefault()
  if (e.deltaY > 0) nextPage()
  else prevPage()
}

const toggleImmersiveMode = () => {
  isImmersive.value = !isImmersive.value
  emit('toggle-immersive', isImmersive.value)
}

const handleGoBack = () => { closeAll(); emit('go-back') }

const progressPercent = computed(() => {
  if (chapters.value.length === 0) return 0
  const cw = 100 / chapters.value.length
  const inC = totalPages.value > 0 ? ((currentPage.value + 1) / totalPages.value) * cw : cw
  return Math.min(100, Math.round(currentChapterIndex.value * cw + inC))
})

const handleProgressSlider = (e: Event) => {
  const p = parseInt((e.target as HTMLInputElement).value)
  const idx = Math.floor((p / 100) * chapters.value.length)
  goToChapter(Math.min(idx, chapters.value.length - 1), true)
}

const readerBgStyle = computed(() => {
  if (!bgImage.value) return {}
  return {
    backgroundImage: `url('${bgImage.value}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

const textStyle = computed(() => ({
  fontFamily: fontFamily.value,
  fontSize: fontSize.value + 'px',
  lineHeight: String(lineHeight.value),
  letterSpacing: letterSpacing.value + 'em',
  fontWeight: String(fontWeight.value),
  color: fontColor.value,
}))

const currentChapterData = computed(() => chapters.value[currentChapterIndex.value] || null)

// Scroll TOC to current chapter when opened
watch(showToc, (v) => {
  if (v) {
    nextTick(() => {
      const active = tocListRef.value?.querySelector('.toc-active') as HTMLElement
      if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }
})

watch(currentChapterIndex, () => recalc())
watch([fontSize, lineHeight, letterSpacing, marginX, marginY, fontFamily, fontWeight], () => recalc())

onMounted(async () => {
  await loadSettings()
  await fetchBook()
  await fetchChapters()
  loading.value = false
  setTimeout(calculatePages, 300)
  window.addEventListener('resize', recalc)
})
onUnmounted(() => { window.removeEventListener('resize', recalc) })
</script>

<template>
  <div class="reader-root" :style="readerBgStyle" @wheel="handleWheel" @click="handleClick">
    <!-- Loading -->
    <div v-if="loading" class="loading-screen">
      <div class="spinner"></div>
      <p>正在载入...</p>
    </div>

    <template v-else>
      <!-- Page flip overlay effect -->
      <div class="flip-overlay" :class="flipAnim"></div>

      <!-- Content -->
      <div ref="containerRef" class="page-container" :style="{ padding: `${marginY}px ${marginX}px` }">
        <div
          ref="contentRef"
          class="page-content"
          :class="{ 'chapter-fading': chapterFading }"
          :style="{
            ...textStyle,
            transform: `translateX(${pageOffset})`,
            columnWidth: `calc(100vw - ${marginX * 2}px)`,
            columnGap: `${marginX * 2}px`,
            columnFill: 'auto',
          }"
        >
          <h2 class="chapter-title" :style="{ fontSize: (fontSize * 1.4) + 'px', color: fontColor }">
            {{ currentChapterData?.title }}
          </h2>
          <div v-html="currentChapterData?.body" class="chapter-body"></div>
        </div>
      </div>

      <!-- HUD -->
      <div v-if="!showMenu" class="hud">
        <span class="hud-pill">{{ currentPage === 0 ? book?.title : currentChapterData?.title }}</span>
        <span class="hud-pill mono">{{ progressPercent }}%</span>
      </div>

      <!-- MENU -->
      <Transition name="fade">
        <div v-if="showMenu" class="menu-overlay">
          <div class="menu-top" @click.stop>
            <button @click="handleGoBack" class="back-btn">← 书架</button>
            <div class="menu-title">{{ book?.title }}</div>
            <div class="menu-actions">
              <button @click="toggleImmersiveMode" class="menu-btn">{{ isImmersive ? '退出全屏' : '全屏' }}</button>
              <button @click="showToc = !showToc; if(showToc) showStyling = false" class="menu-btn" :class="{ active: showToc }">☰ 目录</button>
              <button @click="showStyling = !showStyling; if(showStyling) showToc = false" class="menu-btn" :class="{ active: showStyling }">Aa 排版</button>
            </div>
          </div>

          <div class="menu-bottom" @click.stop>
            <button @click="crossfadeChapter(currentChapterIndex - 1, false)" :disabled="currentChapterIndex === 0" class="ch-btn">⏮ 上一章</button>
            <div class="progress-wrap">
              <input type="range" min="0" max="100" :value="progressPercent" @input="handleProgressSlider" class="progress-slider">
              <div class="progress-label">{{ progressPercent }}%</div>
            </div>
            <button @click="crossfadeChapter(currentChapterIndex + 1)" :disabled="currentChapterIndex >= chapters.length - 1" class="ch-btn">下一章 ⏭</button>
          </div>
          <div class="menu-info" @click.stop>
            <span>第 {{ currentChapterIndex + 1 }} / {{ chapters.length }} 章</span>
            <span>「{{ currentChapterData?.title }}」</span>
            <span>第 {{ currentPage + 1 }} / {{ totalPages }} 页</span>
          </div>

          <!-- TOC -->
          <Transition name="slide-fade">
            <div v-if="showToc" class="toc-panel" @click.stop @wheel.stop>
              <div class="sp-hdr"><span class="sp-title">目录</span><button @click="showToc = false" class="sp-x">✕</button></div>
              <div ref="tocListRef" class="toc-list">
                <button v-for="(ch, i) in chapters" :key="ch.id" @click="goToChapter(i, true)" class="toc-item" :class="{ 'toc-active': i === currentChapterIndex }">
                  <span class="toc-i">{{ i + 1 }}</span><span class="toc-n">{{ ch.title }}</span>
                </button>
              </div>
            </div>
          </Transition>

          <!-- STYLING -->
          <Transition name="slide-fade">
            <div v-if="showStyling" class="styling-panel" @click.stop @wheel.stop>
              <div class="sp-hdr"><span class="sp-title">排版设置</span><button @click="showStyling = false" class="sp-x">✕</button></div>

              <div class="sp-row">
                <label>字体</label>
                <select v-model="fontFamily" @change="updateStyling" class="sp-sel">
                  <option value="system-ui">系统默认</option>
                  <option value="serif">宋体 Serif</option>
                  <option value="'Microsoft YaHei'">微软雅黑</option>
                  <option v-for="f in systemFonts" :key="f" :value="`'${f}'`">{{ f }}</option>
                </select>
              </div>
              <div class="sp-row">
                <label>字色</label>
                <input type="color" v-model="fontColor" @input="updateStyling" class="sp-color">
                <input type="text" v-model="fontColor" @change="updateStyling" class="sp-num w72">
              </div>
              <div class="sp-row">
                <label>字号</label>
                <input type="range" min="12" max="64" step="1" v-model.number="fontSize" @input="updateStyling" class="sp-slider">
                <input type="number" v-model.number="fontSize" @change="updateStyling" class="sp-num"><span class="sp-u">px</span>
              </div>
              <div class="sp-row">
                <label>字重</label>
                <input type="range" min="100" max="900" step="1" v-model.number="fontWeight" @input="updateStyling" class="sp-slider">
                <input type="number" v-model.number="fontWeight" step="1" @change="updateStyling" class="sp-num">
              </div>
              <div class="sp-row">
                <label>行间距</label>
                <input type="range" min="1" max="4" step="0.1" v-model.number="lineHeight" @input="updateStyling" class="sp-slider">
                <input type="number" v-model.number="lineHeight" step="0.1" @change="updateStyling" class="sp-num">
              </div>
              <div class="sp-row">
                <label>字间距</label>
                <input type="range" min="-0.1" max="1" step="0.01" v-model.number="letterSpacing" @input="updateStyling" class="sp-slider">
                <input type="number" v-model.number="letterSpacing" step="0.01" @change="updateStyling" class="sp-num"><span class="sp-u">em</span>
              </div>
              <div class="sp-row">
                <label>左右边距</label>
                <input type="range" min="0" max="200" step="1" v-model.number="marginX" @input="updateStyling" class="sp-slider">
                <input type="number" v-model.number="marginX" @change="updateStyling" class="sp-num"><span class="sp-u">px</span>
              </div>
              <div class="sp-row">
                <label>上下边距</label>
                <input type="range" min="0" max="150" step="1" v-model.number="marginY" @input="updateStyling" class="sp-slider">
                <input type="number" v-model.number="marginY" @change="updateStyling" class="sp-num"><span class="sp-u">px</span>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
/* ---- Root: force light color-scheme to prevent system dark mode ---- */
.reader-root {
  position: fixed; inset: 0; overflow: hidden; user-select: none;
  display: flex; flex-direction: column;
  background: #0f172a; color: white;
  color-scheme: only light;
  -webkit-font-smoothing: antialiased;
}

/* ---- Loading ---- */
.loading-screen { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; color:rgba(255,255,255,0.5); z-index:1; }
.spinner { width:40px; height:40px; border:2px solid rgba(59,130,246,0.2); border-top-color:#3b82f6; border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg) } }

/* ---- Page flip overlay ---- */
.flip-overlay {
  position: absolute; inset: 0; z-index: 5; pointer-events: none;
  opacity: 0; transition: none;
}
.flip-overlay.flip-left {
  animation: flipShadowLeft 0.28s ease-out;
}
.flip-overlay.flip-right {
  animation: flipShadowRight 0.28s ease-out;
}

@keyframes flipShadowLeft {
  0%   { opacity:1; background: linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 30%); }
  50%  { opacity:1; background: linear-gradient(to left, rgba(0,0,0,0.15) 0%, transparent 50%); }
  100% { opacity:0; background: transparent; }
}
@keyframes flipShadowRight {
  0%   { opacity:1; background: linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 30%); }
  50%  { opacity:1; background: linear-gradient(to right, rgba(0,0,0,0.15) 0%, transparent 50%); }
  100% { opacity:0; background: transparent; }
}

/* ---- Content ---- */
.page-container { width:100%; height:100%; overflow:hidden; box-sizing:border-box; flex:1; z-index:1; }
.page-content {
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.25s ease;
  column-fill: auto;
}
.page-content.chapter-fading { opacity: 0; }

.chapter-title { font-weight:700; margin-bottom:1.5em; opacity:0.85; }
.chapter-body { height:100%; }
.chapter-body :deep(p) { text-indent:2em; margin-bottom:0.8em; }

/* ---- HUD ---- */
.hud { position:absolute; bottom:16px; left:24px; right:24px; display:flex; justify-content:space-between; pointer-events:none; z-index:10; }
.hud-pill { font-size:11px; font-weight:600; background:rgba(15,23,42,0.5); backdrop-filter:blur(8px); padding:4px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.06); opacity:0.7; }
.hud-pill.mono { font-family:'Consolas',monospace; }

/* ---- Menu ---- */
.menu-overlay { position:absolute; inset:0; z-index:50; display:flex; flex-direction:column; }
.menu-top { display:flex; align-items:center; gap:12px; padding:0 20px; height:52px; background:rgba(15,23,42,0.92); backdrop-filter:blur(20px); border-bottom:1px solid rgba(255,255,255,0.06); }
.back-btn { background:none; border:1px solid rgba(255,255,255,0.15); color:white; font-size:13px; font-weight:600; cursor:pointer; padding:6px 14px; border-radius:10px; transition:all .2s; white-space:nowrap; }
.back-btn:hover { background:rgba(255,255,255,0.1); }
.menu-title { font-weight:700; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:30%; opacity:0.8; }
.menu-actions { margin-left:auto; display:flex; gap:6px; }
.menu-btn { padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:white; cursor:pointer; transition:all .2s; }
.menu-btn:hover { background:rgba(59,130,246,0.2); }
.menu-btn.active { background:#3b82f6; border-color:#3b82f6; box-shadow:0 4px 12px rgba(59,130,246,0.3); }

.menu-bottom { margin-top:auto; display:flex; align-items:center; gap:16px; padding:14px 24px; background:rgba(15,23,42,0.92); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,0.06); }
.ch-btn { padding:8px 14px; border-radius:10px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:white; cursor:pointer; white-space:nowrap; transition:all .2s; }
.ch-btn:hover:not(:disabled) { background:rgba(59,130,246,0.2); }
.ch-btn:disabled { opacity:0.25; cursor:default; }
.progress-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
.progress-slider { width:100%; height:6px; -webkit-appearance:none; appearance:none; background:rgba(255,255,255,0.1); border-radius:3px; outline:none; cursor:pointer; }
.progress-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; background:white; border:2px solid #3b82f6; border-radius:50%; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); }
.progress-label { font-size:10px; font-family:monospace; color:rgba(255,255,255,0.5); }
.menu-info { display:flex; justify-content:space-between; padding:0 24px 10px; font-size:11px; color:rgba(255,255,255,0.4); font-weight:600; background:rgba(15,23,42,0.92); backdrop-filter:blur(20px); }

/* ---- TOC ---- */
.toc-panel { position:absolute; left:20px; top:60px; bottom:120px; width:300px; background:rgba(15,23,42,0.95); backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:16px; z-index:60; box-shadow:0 20px 60px rgba(0,0,0,0.5); display:flex; flex-direction:column; }
.toc-list { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
.toc-list::-webkit-scrollbar { width:4px; }
.toc-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
.toc-item { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; border:none; background:transparent; color:rgba(255,255,255,0.6); font-size:13px; cursor:pointer; text-align:left; transition:all .15s; }
.toc-item:hover { background:rgba(255,255,255,0.06); color:white; }
.toc-active { background:rgba(59,130,246,0.15)!important; color:#60a5fa!important; font-weight:700; }
.toc-i { font-size:10px; opacity:0.4; min-width:24px; font-family:monospace; }
.toc-n { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ---- Styling Panel ---- */
.styling-panel { position:absolute; right:20px; top:60px; bottom:120px; width:340px; overflow-y:auto; background:rgba(15,23,42,0.95); backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; z-index:60; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
.styling-panel::-webkit-scrollbar { width:4px; }
.styling-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

.sp-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
.sp-title { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.15em; opacity:0.5; }
.sp-x { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:16px; }
.sp-x:hover { color:white; }

.sp-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.sp-row label { font-size:12px; font-weight:600; opacity:0.6; min-width:56px; flex-shrink:0; }
.sp-slider { flex:1; height:4px; -webkit-appearance:none; appearance:none; background:rgba(255,255,255,0.1); border-radius:2px; outline:none; }
.sp-slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; background:white; border:2px solid #3b82f6; border-radius:50%; cursor:pointer; }
.sp-num { width:52px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 6px; text-align:center; font-size:12px; font-family:monospace; color:white; outline:none; }
.sp-num:focus { border-color:#3b82f6; }
.sp-num.w72 { width:72px; }
.sp-u { font-size:10px; opacity:0.3; font-family:monospace; min-width:20px; }
.sp-sel { flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; font-size:13px; color:white; outline:none; cursor:pointer; }
.sp-sel option { background:#0f172a; color:white; }
.sp-color { width:36px; height:30px; border:1px solid rgba(255,255,255,0.15); border-radius:8px; background:transparent; cursor:pointer; padding:2px; }

/* ---- Transitions ---- */
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-fade-enter-active, .slide-fade-leave-active { transition: all .3s ease; }
.slide-fade-enter-from { opacity:0; transform:translateY(12px); }
.slide-fade-leave-to { opacity:0; transform:translateY(12px); }
</style>
