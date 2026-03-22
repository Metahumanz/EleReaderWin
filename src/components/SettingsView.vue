<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh-settings'): void
}>()

interface Setting {
  key: string
  value: string
}

const webdavUrl = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')
const bgImage = ref('')
const bgPreview = ref('')

const loadSettings = async () => {
  try {
    const result = await window.electronAPI.db.query('SELECT * FROM settings')
    const settings = result as Setting[]
    for (const setting of settings) {
      switch (setting.key) {
        case 'webdavUrl': webdavUrl.value = setting.value || ''; break
        case 'webdavUsername': webdavUsername.value = setting.value || ''; break
        case 'webdavPassword': webdavPassword.value = setting.value || ''; break
        case 'bgImage': bgImage.value = setting.value || ''; bgPreview.value = setting.value || ''; break
      }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

const saveSetting = async (key: string, value: string) => {
  try {
    await window.electronAPI.db.query(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    )
  } catch (error) {
    console.error('Failed to save setting:', error)
  }
}

const saveWebdavSettings = async () => {
  await saveSetting('webdavUrl', webdavUrl.value)
  await saveSetting('webdavUsername', webdavUsername.value)
  await saveSetting('webdavPassword', webdavPassword.value)
  alert('WebDAV 设置已保存')
}

const setAspectRatio = async (ratio: number) => {
  await window.electronAPI.win.setAspectRatio(ratio)
}

const browseImage = async () => {
  const filePath = await window.electronAPI.dialog.openImage()
  if (filePath) {
    // Convert Windows path to file:// URL for CSS
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')
    bgImage.value = fileUrl
    bgPreview.value = fileUrl
  }
}

const applyBgImage = async () => {
  // Normalize path if user typed a Windows path without file://
  let val = bgImage.value.trim()
  if (val && !val.startsWith('file://') && !val.startsWith('http')) {
    val = 'file:///' + val.replace(/\\/g, '/')
  }
  bgImage.value = val
  bgPreview.value = val
  await saveSetting('bgImage', val)
  emit('refresh-settings')
}

const clearBgImage = async () => {
  bgImage.value = ''
  bgPreview.value = ''
  await saveSetting('bgImage', '')
  emit('refresh-settings')
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto space-y-10 pb-20">
    <div class="flex items-center gap-6">
      <button
        @click="emit('back')"
        class="p-3 glass rounded-2xl hover:bg-white/10 transition-all active:scale-90"
      >
        <span class="text-xl">←</span>
      </button>
      <h2 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
        偏好设置
      </h2>
    </div>

    <!-- Window Settings -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-xl">🪟</span>
        <h3 class="text-lg font-bold">窗口比例</h3>
      </div>
      <p class="text-sm text-slate-400">快速调整主窗口尺寸比例（窗口大小和位置会自动记忆）</p>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button @click="setAspectRatio(16/9)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">16 : 9</button>
        <button @click="setAspectRatio(9/16)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">9 : 16</button>
        <button @click="setAspectRatio(4/3)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">4 : 3</button>
        <button @click="setAspectRatio(3/4)" class="glass px-4 py-3 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/50 transition-all font-mono text-sm">3 : 4</button>
      </div>
    </section>

    <!-- Appearance Settings -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-xl">🎨</span>
        <h3 class="text-lg font-bold">个性化背景</h3>
      </div>

      <!-- Preview -->
      <div v-if="bgPreview" class="relative w-full h-40 rounded-2xl overflow-hidden border border-white/10">
        <img :src="bgPreview" class="w-full h-full object-cover" alt="背景预览" @error="bgPreview = ''" />
        <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
          <span class="text-sm font-bold opacity-60">背景预览</span>
        </div>
      </div>

      <div>
        <label class="block text-sm text-slate-400 mb-3">背景图片路径</label>
        <div class="flex gap-3">
          <input
            type="text"
            v-model="bgImage"
            placeholder="点击浏览选择图片..."
            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all"
          />
          <button @click="browseImage" class="px-5 py-2 glass rounded-xl font-bold transition-all active:scale-95 hover:bg-white/10">
            📂 浏览
          </button>
          <button @click="applyBgImage" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20">
            应用
          </button>
        </div>
        <div class="flex gap-3 mt-3">
          <button v-if="bgImage" @click="clearBgImage" class="text-xs text-red-400 hover:text-red-300 transition-colors">
            ✕ 清除背景
          </button>
        </div>
      </div>
    </section>

    <!-- WebDAV Settings -->
    <section class="glass-dark rounded-3xl p-8 border border-white/5 space-y-6 opacity-60">
      <div class="flex items-center gap-3">
        <span class="text-xl">☁️</span>
        <h3 class="text-lg font-bold">WebDAV 同步</h3>
      </div>
      
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">服务器地址</label>
          <input type="text" v-model="webdavUrl" placeholder="https://dav.jianguoyun.com/dav/"
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">用户名</label>
            <input type="text" v-model="webdavUsername" placeholder="your@email.com"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">密码/密钥</label>
            <input type="password" v-model="webdavPassword" placeholder="••••••••"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
          </div>
        </div>

        <button @click="saveWebdavSettings"
          class="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 font-bold transition-all active:scale-95">
          保存 WebDAV 配置
        </button>
      </div>
    </section>

    <!-- Version Info -->
    <div class="text-center space-y-2 pt-10">
      <div class="text-xl font-black italic tracking-tighter text-white/20">ELE READER</div>
      <p class="text-xs text-slate-600">Version 0.1.3 | Build 2026.03.22</p>
    </div>
  </div>
</template>

<style scoped>
section {
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
