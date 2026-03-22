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

// Flip mode: 'slide' or 'cover'
const flipMode = ref<'slide' | 'cover'>('slide')

// Pagination
const currentPage = ref(0)
const totalPages = ref(1)
const contentRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// Three-container carousel
const prevContentRef = ref<HTMLElement | null>(null)
const prevContainerRef = ref<HTMLElement | null>(null)
const carouselSliding = ref(false)
const carouselPos = ref(0)
const prevPageCount = ref(1)
const tocListRef = ref<HTMLElement | null>(null)
const suppressAnim = ref(false) // suppress translateX transition during chapter switch

// Cover mode animation
const coverDir = ref<'' | 'cover-left' | 'cover-right'>('')

let flipLock = false

// ---- Data ----
const fetchBook = async () => {
  try {
    const r = await window.electronAPI.db.query('SELECT * FROM books WHERE id = ?', [props.bookId])
    if (Array.isArray(r) && r.length > 0) {
      book.value = r[0] as Book
      currentChapterIndex.value = book.value.progress_index || 0
      currentPage.value = book.value.progress_offset || 0
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
        if (s.key === 'reader_flipMode') flipMode.value = (s.value === 'cover' ? 'cover' : 'slide')
      })
    }
    try { systemFonts.value = await window.electronAPI.font.getSystemFonts() } catch (_) { systemFonts.value = [] }
  } catch (e) { console.error(e) }
}

const saveSetting = async (k: string, v: any) => {
  await window.electronAPI.db.query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, String(v)])
}
const updateStyling = () => {
  saveSetting('reader_fontSize', fontSize.value); saveSetting('reader_lineHeight', lineHeight.value)
  saveSetting('reader_letterSpacing', letterSpacing.value); saveSetting('reader_fontWeight', fontWeight.value)
  saveSetting('reader_marginX', marginX.value); saveSetting('reader_marginY', marginY.value)
  saveSetting('reader_fontFamily', fontFamily.value); saveSetting('reader_fontColor', fontColor.value)
  recalc()
}
const setFlipMode = (mode: 'slide' | 'cover') => {
  flipMode.value = mode
  saveSetting('reader_flipMode', mode)
}

// ---- Pagination ----
const recalc = () => { nextTick(() => { setTimeout(calculatePages, 60) }) }
const calculatePages = () => {
  if (!contentRef.value || !containerRef.value) return
  const cw = containerRef.value.clientWidth
  if (cw <= 0) return
  totalPages.value = Math.max(1, Math.ceil(contentRef.value.scrollWidth / cw))
  if (currentPage.value >= totalPages.value) currentPage.value = totalPages.value - 1
  calcPrevPages()
}
const calcPrevPages = () => {
  if (!prevContentRef.value || !prevContainerRef.value) return
  const cw = prevContainerRef.value.clientWidth
  if (cw <= 0) return
  prevPageCount.value = Math.max(1, Math.ceil(prevContentRef.value.scrollWidth / cw))
}

const pageOffset = computed(() => {
  if (!containerRef.value) return '0px'
  return `-${currentPage.value * containerRef.value.clientWidth}px`
})
const prevPageOffset = computed(() => {
  if (!prevContainerRef.value) return '0px'
  return `-${Math.max(0, prevPageCount.value - 1) * prevContainerRef.value.clientWidth}px`
})

const saveProgress = async () => {
  if (!book.value) return
  try {
    await window.electronAPI.db.query('UPDATE books SET progress_index = ?, progress_offset = ?, last_read = ? WHERE id = ?',
      [currentChapterIndex.value, currentPage.value, new Date().toISOString(), props.bookId])
  } catch (e) { console.error(e) }
}

// Chapter data
const currentChapterData = computed(() => chapters.value[currentChapterIndex.value] || null)
const prevChapterData = computed(() => { const i = currentChapterIndex.value - 1; return i >= 0 ? chapters.value[i] : null })
const nextChapterData = computed(() => { const i = currentChapterIndex.value + 1; return i < chapters.value.length ? chapters.value[i] : null })

// ---- Carousel chapter transition ----
const slideToNextChapter = () => {
  if (flipLock || currentChapterIndex.value >= chapters.value.length - 1) return
  flipLock = true
  suppressAnim.value = true
  carouselSliding.value = true
  carouselPos.value = 1
  setTimeout(() => {
    carouselSliding.value = false
    currentChapterIndex.value++
    currentPage.value = 0
    carouselPos.value = 0
    saveProgress()
    nextTick(() => { requestAnimationFrame(() => { calculatePages(); requestAnimationFrame(() => { suppressAnim.value = false; flipLock = false }) }) })
  }, 380)
}

const slideToPrevChapter = () => {
  if (flipLock || currentChapterIndex.value <= 0) return
  flipLock = true
  suppressAnim.value = true
  carouselSliding.value = true
  carouselPos.value = -1
  setTimeout(() => {
    carouselSliding.value = false
    currentChapterIndex.value--
    carouselPos.value = 0
    nextTick(() => {
      requestAnimationFrame(() => {
        calculatePages()
        currentPage.value = Math.max(0, totalPages.value - 1)
        saveProgress()
        requestAnimationFrame(() => { suppressAnim.value = false; flipLock = false })
      })
    })
  }, 380)
}

const goToChapter = (idx: number, keepMenu = false) => {
  if (idx >= 0 && idx < chapters.value.length && idx !== currentChapterIndex.value) {
    suppressAnim.value = true
    currentChapterIndex.value = idx
    currentPage.value = 0
    saveProgress()
    nextTick(() => { requestAnimationFrame(() => { calculatePages(); requestAnimationFrame(() => { suppressAnim.value = false }) }) })
  }
  if (!keepMenu) closeAll()
}

// ---- Page navigation ----
const doPageFlip = (dir: 'left' | 'right', action: () => void) => {
  if (flipMode.value === 'cover') {
    // Cover mode: opaque page slides across, hiding the snap
    flipLock = true
    suppressAnim.value = true
    coverDir.value = dir === 'left' ? 'cover-left' : 'cover-right'
    // Content snaps to new page immediately (hidden by overlay)
    requestAnimationFrame(() => { action() })
    setTimeout(() => {
      suppressAnim.value = false
      coverDir.value = ''
      flipLock = false
    }, 380)
  } else {
    // Slide mode: CSS transition handles it
    action()
  }
}

const nextPage = () => {
  if (flipLock) return
  if (currentPage.value < totalPages.value - 1) {
    doPageFlip('left', () => { currentPage.value++ })
  } else {
    slideToNextChapter()
  }
}

const prevPage = () => {
  if (flipLock) return
  if (currentPage.value > 0) {
    doPageFlip('right', () => { currentPage.value-- })
  } else {
    slideToPrevChapter()
  }
}

// ---- Interaction ----
const closeAll = () => { showMenu.value = false; showStyling.value = false; showToc.value = false }

const handleClick = (e: MouseEvent) => {
  const t = e.target as HTMLElement
  if (t.closest('.m-top') || t.closest('.m-bot') || t.closest('.m-info') ||
      t.closest('.sty-p') || t.closest('.toc-p')) return
  if (showMenu.value) { closeAll(); return }
  const x = e.clientX, w = window.innerWidth
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

const handleKeydown = (e: KeyboardEvent) => {
  if (showMenu.value) return
  const k = e.key, c = e.code
  if (k === 'ArrowRight' || k === 'd' || k === 'D' || c === 'Numpad6' || k === 'PageDown' ||
      k === 'ArrowDown' || k === 's' || k === 'S' || c === 'Numpad2') { e.preventDefault(); nextPage() }
  else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || c === 'Numpad4' || k === 'PageUp' ||
           k === 'ArrowUp' || k === 'w' || k === 'W' || c === 'Numpad8') { e.preventDefault(); prevPage() }
}

const toggleImmersiveMode = () => { isImmersive.value = !isImmersive.value; emit('toggle-immersive', isImmersive.value) }
const handleGoBack = () => { saveProgress(); closeAll(); emit('go-back') }

const progressPercent = computed(() => {
  if (chapters.value.length === 0) return 0
  const cw = 100 / chapters.value.length
  const inC = totalPages.value > 0 ? ((currentPage.value + 1) / totalPages.value) * cw : cw
  return Math.min(100, Math.round(currentChapterIndex.value * cw + inC))
})

const handleProgressSlider = (e: Event) => {
  const p = parseInt((e.target as HTMLInputElement).value)
  goToChapter(Math.min(Math.floor((p / 100) * chapters.value.length), chapters.value.length - 1), true)
}

const readerBgStyle = computed(() => {
  if (!bgImage.value) return {}
  return { backgroundImage: `url('${bgImage.value}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
})

const textStyle = computed(() => ({
  fontFamily: fontFamily.value, fontSize: fontSize.value + 'px',
  lineHeight: String(lineHeight.value), letterSpacing: letterSpacing.value + 'em',
  fontWeight: String(fontWeight.value), color: fontColor.value,
}))

const carouselTransform = computed(() => `translateX(${-100 + carouselPos.value * -100}vw)`)

watch(showToc, (v) => {
  if (v) nextTick(() => {
    const el = tocListRef.value?.querySelector('.toc-active') as HTMLElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  })
})

watch(currentChapterIndex, () => recalc())
watch([fontSize, lineHeight, letterSpacing, marginX, marginY, fontFamily, fontWeight], () => recalc())

// Save progress periodically
watch(currentPage, () => saveProgress())

onMounted(async () => {
  await loadSettings(); await fetchBook(); await fetchChapters()
  loading.value = false
  setTimeout(calculatePages, 300)
  window.addEventListener('resize', recalc)
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  saveProgress()
  window.removeEventListener('resize', recalc)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="reader-root" :style="readerBgStyle" @wheel="handleWheel" @click="handleClick">
    <div v-if="loading" class="load"><div class="spinner"></div><p>正在载入...</p></div>

    <template v-else>
      <!-- Cover animation overlay -->
      <div v-if="coverDir" class="cover-overlay" :class="coverDir"></div>

      <!-- Three-container carousel -->
      <div class="carousel" :class="{ sliding: carouselSliding }" :style="{ transform: carouselTransform }">
        <!-- PREV chapter (last page) -->
        <div class="slide">
          <div ref="prevContainerRef" class="pg-ctr" :style="{ padding: `${marginY}px ${marginX}px` }">
            <div ref="prevContentRef" class="pg-ct" :style="{
              ...textStyle,
              transform: `translateX(${prevPageOffset})`,
              columnWidth: `calc(100vw - ${marginX * 2}px)`,
              columnGap: `${marginX * 2}px`, columnFill: 'auto',
            }" v-if="prevChapterData">
              <h2 class="ch-title" :style="{ fontSize: (fontSize*1.4)+'px', color: fontColor }">{{ prevChapterData.title }}</h2>
              <div v-html="prevChapterData.body" class="ch-body"></div>
            </div>
          </div>
        </div>

        <!-- CURRENT chapter -->
        <div class="slide">
          <div ref="containerRef" class="pg-ctr" :style="{ padding: `${marginY}px ${marginX}px` }">
            <div ref="contentRef" class="pg-ct" :class="{ 'pg-anim': !suppressAnim }" :style="{
              ...textStyle,
              transform: `translateX(${pageOffset})`,
              columnWidth: `calc(100vw - ${marginX * 2}px)`,
              columnGap: `${marginX * 2}px`, columnFill: 'auto',
            }">
              <h2 class="ch-title" :style="{ fontSize: (fontSize*1.4)+'px', color: fontColor }">{{ currentChapterData?.title }}</h2>
              <div v-html="currentChapterData?.body" class="ch-body"></div>
            </div>
          </div>
        </div>

        <!-- NEXT chapter (first page) -->
        <div class="slide">
          <div class="pg-ctr" :style="{ padding: `${marginY}px ${marginX}px` }">
            <div class="pg-ct" :style="textStyle" v-if="nextChapterData">
              <h2 class="ch-title" :style="{ fontSize: (fontSize*1.4)+'px', color: fontColor }">{{ nextChapterData.title }}</h2>
              <div v-html="nextChapterData.body" class="ch-body"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- HUD -->
      <div v-if="!showMenu" class="hud">
        <span class="hp">{{ currentPage === 0 ? book?.title : currentChapterData?.title }}</span>
        <span class="hp mono">{{ progressPercent }}%</span>
      </div>

      <!-- MENU -->
      <Transition name="fade">
        <div v-if="showMenu" class="menu-ov">
          <div class="m-top" @click.stop>
            <button @click="handleGoBack" class="m-back">← 书架</button>
            <div class="m-title">{{ book?.title }}</div>
            <div class="m-acts">
              <button @click="toggleImmersiveMode" class="m-btn">{{ isImmersive ? '退出全屏' : '全屏' }}</button>
              <button @click="showToc=!showToc;if(showToc)showStyling=false" class="m-btn" :class="{active:showToc}">☰ 目录</button>
              <button @click="showStyling=!showStyling;if(showStyling)showToc=false" class="m-btn" :class="{active:showStyling}">Aa 排版</button>
            </div>
          </div>
          <div class="m-bot" @click.stop>
            <button @click="goToChapter(currentChapterIndex-1,true)" :disabled="currentChapterIndex===0" class="m-ch">⏮ 上一章</button>
            <div class="m-prog"><input type="range" min="0" max="100" :value="progressPercent" @input="handleProgressSlider" class="m-slider"><div class="m-pct">{{ progressPercent }}%</div></div>
            <button @click="goToChapter(currentChapterIndex+1,true)" :disabled="currentChapterIndex>=chapters.length-1" class="m-ch">下一章 ⏭</button>
          </div>
          <div class="m-info" @click.stop>
            <span>第 {{ currentChapterIndex+1 }}/{{ chapters.length }} 章</span>
            <span>「{{ currentChapterData?.title }}」</span>
            <span>第 {{ currentPage+1 }}/{{ totalPages }} 页</span>
            <!-- Flip mode toggle -->
            <span class="flip-toggle">
              翻页:
              <button @click="setFlipMode('slide')" class="ft-btn" :class="{ftActive: flipMode==='slide'}">平移</button>
              <button @click="setFlipMode('cover')" class="ft-btn" :class="{ftActive: flipMode==='cover'}">覆盖</button>
            </span>
          </div>

          <Transition name="sf">
            <div v-if="showToc" class="toc-p" @click.stop @wheel.stop>
              <div class="ph"><span class="pt">目录</span><button @click="showToc=false" class="px">✕</button></div>
              <div ref="tocListRef" class="toc-l">
                <button v-for="(ch,i) in chapters" :key="ch.id" @click="goToChapter(i,true)" class="toc-i" :class="{'toc-active':i===currentChapterIndex}">
                  <span class="ti">{{ i+1 }}</span><span class="tn">{{ ch.title }}</span>
                </button>
              </div>
            </div>
          </Transition>

          <Transition name="sf">
            <div v-if="showStyling" class="sty-p" @click.stop @wheel.stop>
              <div class="ph"><span class="pt">排版设置</span><button @click="showStyling=false" class="px">✕</button></div>
              <div class="sr"><label>字体</label><select v-model="fontFamily" @change="updateStyling" class="ss"><option value="system-ui">系统默认</option><option value="serif">宋体</option><option value="'Microsoft YaHei'">微软雅黑</option><option v-for="f in systemFonts" :key="f" :value="`'${f}'`">{{ f }}</option></select></div>
              <div class="sr"><label>字色</label><input type="color" v-model="fontColor" @input="updateStyling" class="sc"><input type="text" v-model="fontColor" @change="updateStyling" class="sn w72"></div>
              <div class="sr"><label>字号</label><input type="range" min="12" max="64" step="1" v-model.number="fontSize" @input="updateStyling" class="sl"><input type="number" v-model.number="fontSize" @change="updateStyling" class="sn"><span class="su">px</span></div>
              <div class="sr"><label>字重</label><input type="range" min="100" max="900" step="1" v-model.number="fontWeight" @input="updateStyling" class="sl"><input type="number" v-model.number="fontWeight" @change="updateStyling" class="sn"><small class="sw-note">*取决于字体</small></div>
              <div class="sr"><label>行间距</label><input type="range" min="1" max="4" step="0.1" v-model.number="lineHeight" @input="updateStyling" class="sl"><input type="number" v-model.number="lineHeight" step="0.1" @change="updateStyling" class="sn"></div>
              <div class="sr"><label>字间距</label><input type="range" min="-0.1" max="1" step="0.01" v-model.number="letterSpacing" @input="updateStyling" class="sl"><input type="number" v-model.number="letterSpacing" step="0.01" @change="updateStyling" class="sn"><span class="su">em</span></div>
              <div class="sr"><label>左右边距</label><input type="range" min="0" max="200" step="1" v-model.number="marginX" @input="updateStyling" class="sl"><input type="number" v-model.number="marginX" @change="updateStyling" class="sn"><span class="su">px</span></div>
              <div class="sr"><label>上下边距</label><input type="range" min="0" max="150" step="1" v-model.number="marginY" @input="updateStyling" class="sl"><input type="number" v-model.number="marginY" @change="updateStyling" class="sn"><span class="su">px</span></div>
            </div>
          </Transition>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.reader-root { position:fixed; inset:0; overflow:hidden; user-select:none; display:flex; flex-direction:column; background:#0f172a; color:white; color-scheme:only light; }
.load { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; color:rgba(255,255,255,0.5); z-index:1; }
.spinner { width:40px; height:40px; border:2px solid rgba(59,130,246,0.2); border-top-color:#3b82f6; border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg) } }

/* Cover overlay — opaque page that slides across to cover/reveal */
.cover-overlay {
  position: absolute; inset: 0; z-index: 5; pointer-events: none;
  background: #0f172a;
}
.cover-overlay.cover-left {
  animation: coverSlideL 0.38s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
  box-shadow: -8px 0 30px rgba(0,0,0,0.5);
}
.cover-overlay.cover-right {
  animation: coverSlideR 0.38s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
  box-shadow: 8px 0 30px rgba(0,0,0,0.5);
}
@keyframes coverSlideL {
  0%   { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
@keyframes coverSlideR {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Carousel */
.carousel { display:flex; width:300vw; height:100%; transform:translateX(-100vw); z-index:1; }
.carousel.sliding { transition: transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94); }
.slide { width:100vw; height:100%; flex-shrink:0; overflow:hidden; }

.pg-ctr { width:100%; height:100%; overflow:hidden; box-sizing:border-box; }
.pg-ct { height:100%; column-fill:auto; }
.pg-ct.pg-anim { transition: transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94); }

.ch-title { font-weight:700; margin-bottom:1.5em; opacity:0.85; }
.ch-body { height:100%; }
.ch-body :deep(p) { text-indent:2em; margin-bottom:0.8em; }
.ch-body :deep(p:first-child) { text-indent:2em; }
.ch-body :deep(> *:first-child) { text-indent:2em; }

/* HUD */
.hud { position:absolute; bottom:16px; left:24px; right:24px; display:flex; justify-content:space-between; pointer-events:none; z-index:10; }
.hp { font-size:11px; font-weight:600; background:rgba(15,23,42,0.5); backdrop-filter:blur(8px); padding:4px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.06); opacity:0.7; }
.hp.mono { font-family:'Consolas',monospace; }

/* Menu */
.menu-ov { position:absolute; inset:0; z-index:50; display:flex; flex-direction:column; }
.m-top { display:flex; align-items:center; gap:12px; padding:0 20px; height:52px; background:rgba(15,23,42,0.92); backdrop-filter:blur(20px); border-bottom:1px solid rgba(255,255,255,0.06); }
.m-back { background:none; border:1px solid rgba(255,255,255,0.15); color:white; font-size:13px; font-weight:600; cursor:pointer; padding:6px 14px; border-radius:10px; transition:all .2s; white-space:nowrap; }
.m-back:hover { background:rgba(255,255,255,0.1); }
.m-title { font-weight:700; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:30%; opacity:0.8; }
.m-acts { margin-left:auto; display:flex; gap:6px; }
.m-btn { padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:white; cursor:pointer; transition:all .2s; }
.m-btn:hover { background:rgba(59,130,246,0.2); }
.m-btn.active { background:#3b82f6; border-color:#3b82f6; box-shadow:0 4px 12px rgba(59,130,246,0.3); }
.m-bot { margin-top:auto; display:flex; align-items:center; gap:16px; padding:14px 24px; background:rgba(15,23,42,0.92); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,0.06); }
.m-ch { padding:8px 14px; border-radius:10px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:white; cursor:pointer; white-space:nowrap; transition:all .2s; }
.m-ch:hover:not(:disabled) { background:rgba(59,130,246,0.2); }
.m-ch:disabled { opacity:0.25; cursor:default; }
.m-prog { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
.m-slider { width:100%; height:6px; -webkit-appearance:none; appearance:none; background:rgba(255,255,255,0.1); border-radius:3px; outline:none; cursor:pointer; }
.m-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; background:white; border:2px solid #3b82f6; border-radius:50%; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); }
.m-pct { font-size:10px; font-family:monospace; color:rgba(255,255,255,0.5); }
.m-info { display:flex; align-items:center; justify-content:space-between; padding:0 24px 10px; font-size:11px; color:rgba(255,255,255,0.4); font-weight:600; background:rgba(15,23,42,0.92); backdrop-filter:blur(20px); gap:12px; flex-wrap:wrap; }

/* Flip mode toggle */
.flip-toggle { display:flex; align-items:center; gap:4px; margin-left:auto; }
.ft-btn { padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:rgba(255,255,255,0.4); font-size:10px; font-weight:700; cursor:pointer; transition:all .15s; }
.ft-btn:hover { color:rgba(255,255,255,0.7); }
.ftActive { background:#3b82f6!important; border-color:#3b82f6!important; color:white!important; }

/* TOC */
.toc-p { position:absolute; left:20px; top:60px; bottom:120px; width:300px; background:rgba(15,23,42,0.95); backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:16px; z-index:60; box-shadow:0 20px 60px rgba(0,0,0,0.5); display:flex; flex-direction:column; }
.toc-l { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
.toc-l::-webkit-scrollbar { width:4px; }
.toc-l::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
.toc-i { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; border:none; background:transparent; color:rgba(255,255,255,0.6); font-size:13px; cursor:pointer; text-align:left; transition:all .15s; }
.toc-i:hover { background:rgba(255,255,255,0.06); color:white; }
.toc-active { background:rgba(59,130,246,0.15)!important; color:#60a5fa!important; font-weight:700; }
.ti { font-size:10px; opacity:0.4; min-width:24px; font-family:monospace; }
.tn { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* Styling */
.sty-p { position:absolute; right:20px; top:60px; bottom:120px; width:340px; overflow-y:auto; background:rgba(15,23,42,0.95); backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; z-index:60; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
.sty-p::-webkit-scrollbar { width:4px; }
.sty-p::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
.ph { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
.pt { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.15em; opacity:0.5; }
.px { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:16px; }
.px:hover { color:white; }
.sr { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
.sr label { font-size:12px; font-weight:600; opacity:0.6; min-width:56px; flex-shrink:0; }
.sl { flex:1; height:4px; -webkit-appearance:none; appearance:none; background:rgba(255,255,255,0.1); border-radius:2px; outline:none; min-width:80px; }
.sl::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; background:white; border:2px solid #3b82f6; border-radius:50%; cursor:pointer; }
.sn { width:52px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 6px; text-align:center; font-size:12px; font-family:monospace; color:white; outline:none; }
.sn:focus { border-color:#3b82f6; }
.sn.w72 { width:72px; }
.su { font-size:10px; opacity:0.3; font-family:monospace; min-width:20px; }
.ss { flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; font-size:13px; color:white; outline:none; cursor:pointer; }
.ss option { background:#0f172a; color:white; }
.sc { width:36px; height:30px; border:1px solid rgba(255,255,255,0.15); border-radius:8px; background:transparent; cursor:pointer; padding:2px; }
.sw-note { font-size:10px; color:rgba(255,255,255,0.3); margin-left:4px; }

/* Transitions */
.fade-enter-active,.fade-leave-active { transition:opacity .25s ease; }
.fade-enter-from,.fade-leave-to { opacity:0; }
.sf-enter-active,.sf-leave-active { transition:all .3s ease; }
.sf-enter-from { opacity:0; transform:translateY(12px); }
.sf-leave-to { opacity:0; transform:translateY(12px); }
</style>
