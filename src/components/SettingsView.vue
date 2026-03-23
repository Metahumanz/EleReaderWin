<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh-settings'): void
}>()

interface Setting { key: string; value: string }
interface ReplacementRule { id: number; pattern: string; replacement: string; scope: string; book_id: number | null; is_regex: number; active: number }
interface Book { id: number; title: string }

const bgImage = ref('')
const bgPreview = ref('')
const showKeyHints = ref(true)
const appVersion = ref('')
const updateStatus = ref('')
const updateDetail = ref('')
const updateAvailable = ref(false)
const updateReady = ref(false)

// Replacement rules
const allRules = ref<ReplacementRule[]>([])
const books = ref<Book[]>([])
const ruleFilter = ref<'all' | 'global' | 'book'>('all')

const loadSettings = async () => {
  try {
    const result = await window.electronAPI.db.query('SELECT * FROM settings')
    const settings = result as Setting[]
    for (const s of settings) {
      if (s.key === 'bgImage') { bgImage.value = s.value || ''; bgPreview.value = s.value || '' }
      if (s.key === 'hideKeyHints') { showKeyHints.value = s.value !== 'true' }
    }
  } catch (e) { console.error(e) }
}

const saveSetting = async (k: string, v: string) => {
  await window.electronAPI.db.query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, v])
}

const setAspectRatio = async (ratio: number) => {
  await window.electronAPI.win.setAspectRatio(ratio)
}

const browseImage = async () => {
  const p = await window.electronAPI.dialog.openImage()
  if (p) { const url = 'file:///' + p.replace(/\\/g, '/'); bgImage.value = url; bgPreview.value = url }
}

const applyBgImage = async () => {
  let v = bgImage.value.trim()
  if (v && !v.startsWith('file://') && !v.startsWith('http')) v = 'file:///' + v.replace(/\\/g, '/')
  bgImage.value = v; bgPreview.value = v
  await saveSetting('bgImage', v)
  emit('refresh-settings')
}

const toggleKeyHints = async () => {
  await saveSetting('hideKeyHints', (!showKeyHints.value).toString())
}

const clearBgImage = async () => {
  bgImage.value = ''; bgPreview.value = ''
  await saveSetting('bgImage', '')
  emit('refresh-settings')
}

const checkForUpdate = async () => {
  updateStatus.value = '正在检查...'
  updateDetail.value = ''
  updateAvailable.value = false
  updateReady.value = false
  await window.electronAPI.updater.check()
}

const downloadUpdate = async () => {
  updateStatus.value = '准备下载...'
  updateAvailable.value = false
  await window.electronAPI.updater.download()
}

const openReleases = () => {
  window.open('https://github.com/Metahumanz/EleReaderWin/releases', '_blank')
}

const installNow = () => {
  window.electronAPI.updater.install()
}

// Replacement rules management
const fetchAllRules = async () => {
  try {
    const r = await window.electronAPI.db.query('SELECT * FROM replacement_rules ORDER BY id')
    allRules.value = r as ReplacementRule[]
  } catch (e) { console.error(e) }
}

const fetchBooks = async () => {
  try {
    const r = await window.electronAPI.db.query('SELECT id, title FROM books ORDER BY title')
    books.value = r as Book[]
  } catch (e) { console.error(e) }
}

const filteredRules = () => {
  if (ruleFilter.value === 'all') return allRules.value
  if (ruleFilter.value === 'global') return allRules.value.filter(r => r.scope === 'global')
  return allRules.value.filter(r => r.scope === 'book')
}

const getBookTitle = (bookId: number | null) => {
  if (!bookId) return ''
  const b = books.value.find(b => b.id === bookId)
  return b ? b.title : `#${bookId}`
}

const deleteRule = async (id: number) => {
  try {
    await window.electronAPI.db.query('DELETE FROM replacement_rules WHERE id = ?', [id])
    await fetchAllRules()
  } catch (e) { console.error(e) }
}

const toggleRuleActive = async (rule: ReplacementRule) => {
  try {
    await window.electronAPI.db.query('UPDATE replacement_rules SET active = ? WHERE id = ?', [rule.active ? 0 : 1, rule.id])
    await fetchAllRules()
  } catch (e) { console.error(e) }
}

onMounted(async () => {
  loadSettings()
  fetchAllRules()
  fetchBooks()
  try { appVersion.value = await window.electronAPI.app.getVersion() } catch (_) { appVersion.value = '?.?.?' }
  window.electronAPI.updater.onStatus((data) => {
    switch (data.status) {
      case 'checking': updateStatus.value = '🔍 正在检查...'; break
      case 'available': updateStatus.value = `🎉 发现新版本 v${data.version}`; updateDetail.value = ''; updateAvailable.value = true; break
      case 'up-to-date': updateStatus.value = '✅ 已是最新版本'; break
      case 'downloading': updateStatus.value = `⏬ 下载中 ${data.percent}%`; break
      case 'downloaded': updateStatus.value = '✅ 下载完成'; updateDetail.value = '可立即安装或等下次启动时自动安装'; updateReady.value = true; updateAvailable.value = false; break
      case 'error': updateStatus.value = '❌ 更新失败'; updateDetail.value = data.message || ''; break
    }
  })
})
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto space-y-10 pb-20">
    <div class="flex items-center gap-6">
      <button @click="emit('back')" class="p-3 glass rounded-2xl hover:bg-white/10 transition-all active:scale-90">
        <span class="text-xl">←</span>
      </button>
      <h2 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">偏好设置</h2>
    </div>

    <!-- Window -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2"><span class="text-xl">🪟</span><h3 class="text-lg font-bold">窗口比例</h3></div>
      <p class="text-sm text-slate-400">快速调整主窗口尺寸比例（窗口大小和位置会自动记忆，最小 300×300）</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button @click="setAspectRatio(16/9)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">16 : 9</button>
        <button @click="setAspectRatio(9/16)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">9 : 16</button>
        <button @click="setAspectRatio(4/3)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">4 : 3</button>
        <button @click="setAspectRatio(3/4)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">3 : 4</button>
      </div>
    </section>

    <!-- UI & Helpers -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2"><span class="text-xl">⌨️</span><h3 class="text-lg font-bold">阅读助手</h3></div>
      <label class="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" v-model="showKeyHints" @change="toggleKeyHints" class="hidden" />
        <div class="w-12 h-6 rounded-full transition-colors duration-300 relative border border-white/10" :class="showKeyHints ? 'bg-blue-600' : 'bg-white/5'">
          <div class="absolute w-4 h-4 rounded-full bg-white top-1 transition-transform duration-300 shadow-sm" :class="!showKeyHints ? 'left-1' : 'translate-x-6 left-1'"></div>
        </div>
        <span class="text-slate-300 text-sm">显示快捷键与操作提示</span>
      </label>
      <p class="text-xs text-slate-500 mt-1 pl-[3.75rem]">开启后，进入阅读界面时将显示快捷键操作指南。</p>
    </section>

    <!-- Background -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2"><span class="text-xl">🎨</span><h3 class="text-lg font-bold">阅读背景</h3></div>
      <div v-if="bgPreview" class="relative w-full h-40 rounded-2xl overflow-hidden border border-white/10">
        <img :src="bgPreview" class="w-full h-full object-cover" alt="背景预览" @error="bgPreview = ''" />
        <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center"><span class="text-sm font-bold opacity-60">背景预览</span></div>
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-3">背景图片路径</label>
        <div class="flex gap-3">
          <input type="text" v-model="bgImage" placeholder="点击浏览选择图片..." class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all" />
          <button @click="browseImage" class="px-5 py-2 glass rounded-xl font-bold transition-all active:scale-95 hover:bg-white/10">📂 浏览</button>
          <button @click="applyBgImage" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20">应用</button>
        </div>
        <div v-if="bgImage" class="mt-3">
          <button @click="clearBgImage" class="text-xs text-red-400 hover:text-red-300 transition-colors">✕ 清除背景</button>
        </div>
      </div>
    </section>

    <!-- Replacement Rules -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2"><span class="text-xl">📝</span><h3 class="text-lg font-bold">替换规则管理</h3></div>
      <p class="text-sm text-slate-400">管理所有替换规则。可在阅读界面中针对单本书或全局添加规则。</p>

      <div class="flex gap-2 mb-4">
        <button @click="ruleFilter='all'" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                :class="ruleFilter==='all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'">全部 ({{ allRules.length }})</button>
        <button @click="ruleFilter='global'" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                :class="ruleFilter==='global' ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'">全局</button>
        <button @click="ruleFilter='book'" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                :class="ruleFilter==='book' ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'">特定书籍</button>
      </div>

      <div v-if="filteredRules().length === 0" class="text-center py-8">
        <p class="text-slate-500 text-sm">暂无替换规则</p>
        <p class="text-slate-600 text-xs mt-1">在阅读界面菜单中点击「📝 替换」按钮添加</p>
      </div>

      <div v-else class="space-y-3">
        <div v-for="rule in filteredRules()" :key="rule.id"
             class="flex items-start gap-4 p-4 rounded-xl border transition-all"
             :class="rule.active ? 'bg-white/3 border-white/8' : 'bg-white/[0.01] border-white/[0.03] opacity-40'">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="text-amber-400 font-semibold text-sm break-all">{{ rule.pattern }}</span>
              <span class="text-white/20 text-xs">→</span>
              <span class="text-emerald-400 font-semibold text-sm break-all">{{ rule.replacement || '(删除)' }}</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded"
                    :class="rule.scope === 'global' ? 'bg-purple-500/15 text-purple-400' : 'bg-sky-500/15 text-sky-400'">
                {{ rule.scope === 'global' ? '全局' : '本书' }}
              </span>
              <span v-if="rule.scope === 'book' && rule.book_id" class="text-[10px] text-slate-500">
                📖 {{ getBookTitle(rule.book_id) }}
              </span>
              <span v-if="rule.is_regex" class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">正则</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click="toggleRuleActive(rule)"
                    class="px-3 py-1 rounded-lg text-xs font-bold transition-all border"
                    :class="rule.active ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-white/10 text-slate-500 hover:bg-white/5'">
              {{ rule.active ? '已启用' : '已禁用' }}
            </button>
            <button @click="deleteRule(rule.id)"
                    class="px-3 py-1 rounded-lg text-xs font-bold text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
              删除
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Update -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2"><span class="text-xl">🔄</span><h3 class="text-lg font-bold">软件更新</h3></div>
      <p class="text-sm text-slate-400">检查更新。下载并安装后，旧版本安装包会在下次启动时自动清理。</p>
      <div class="flex items-center gap-4 flex-wrap">
        <button @click="checkForUpdate" class="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20">检查更新</button>
        <template v-if="updateAvailable">
          <button @click="downloadUpdate" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20">⏬ 后台下载</button>
          <button @click="openReleases" class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all active:scale-95">🌐 浏览器打开</button>
        </template>
        <button v-if="updateReady" @click="installNow" class="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-green-600/20">⬇ 立即安装</button>
        <div v-if="updateStatus">
          <p class="text-sm font-medium">{{ updateStatus }}</p>
          <p v-if="updateDetail" class="text-xs text-slate-400 mt-1">{{ updateDetail }}</p>
        </div>
      </div>
    </section>

    <!-- Version -->
    <div class="text-center space-y-2 pt-10">
      <div class="text-xl font-black italic tracking-tighter text-white/20">ELE READER</div>
      <p class="text-xs text-slate-600">Version {{ appVersion }}</p>
    </div>
  </div>
</template>

<style scoped>
section { animation: slideIn 0.5s ease-out; }
@keyframes slideIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
</style>
