<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh-settings'): void
}>()

interface Setting { key: string; value: string }

const bgImage = ref('')
const bgPreview = ref('')
const appVersion = ref('')
const updateStatus = ref('')
const updateDetail = ref('')
const updateReady = ref(false)

const loadSettings = async () => {
  try {
    const result = await window.electronAPI.db.query('SELECT * FROM settings')
    const settings = result as Setting[]
    for (const s of settings) {
      if (s.key === 'bgImage') { bgImage.value = s.value || ''; bgPreview.value = s.value || '' }
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

const clearBgImage = async () => {
  bgImage.value = ''; bgPreview.value = ''
  await saveSetting('bgImage', '')
  emit('refresh-settings')
}

const checkForUpdate = async () => {
  updateStatus.value = '正在检查...'
  updateDetail.value = ''
  updateReady.value = false
  await window.electronAPI.updater.check()
}

const installNow = () => {
  window.electronAPI.updater.install()
}

onMounted(async () => {
  loadSettings()
  try { appVersion.value = await window.electronAPI.app.getVersion() } catch (_) { appVersion.value = '?.?.?' }
  window.electronAPI.updater.onStatus((data) => {
    switch (data.status) {
      case 'checking': updateStatus.value = '🔍 正在检查更新...'; break
      case 'available': updateStatus.value = `🎉 发现新版本 v${data.version}`; updateDetail.value = '正在下载...'; break
      case 'up-to-date': updateStatus.value = '✅ 已是最新版本'; break
      case 'downloading': updateStatus.value = `⏬ 下载中 ${data.percent}%`; break
      case 'downloaded': updateStatus.value = '✅ 下载完成'; updateDetail.value = '可立即安装或等下次启动时自动安装'; updateReady.value = true; break
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

    <!-- Update -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2"><span class="text-xl">🔄</span><h3 class="text-lg font-bold">软件更新</h3></div>
      <p class="text-sm text-slate-400">应用启动时自动检查更新。下载完成后可选择立即安装或下次启动时安装。</p>
      <div class="flex items-center gap-4 flex-wrap">
        <button @click="checkForUpdate" class="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20">检查更新</button>
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
