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

const loadSettings = async () => {
  try {
    const result = await window.electronAPI.db.query('SELECT * FROM settings')
    const settings = result as Setting[]

    for (const setting of settings) {
      switch (setting.key) {
        case 'webdavUrl':
          webdavUrl.value = setting.value || ''
          break
        case 'webdavUsername':
          webdavUsername.value = setting.value || ''
          break
        case 'webdavPassword':
          webdavPassword.value = setting.value || ''
          break
        case 'bgImage':
          bgImage.value = setting.value || ''
          break
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

const updateBgImage = async () => {
  await saveSetting('bgImage', bgImage.value)
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
      <p class="text-sm text-slate-400">快速调整主窗口尺寸比例</p>
      
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
      <div>
        <label class="block text-sm text-slate-400 mb-3">背景图片 URL (支持本地绝对路径或网络链接)</label>
        <div class="flex gap-3">
          <input
            type="text"
            v-model="bgImage"
            placeholder="C:\Users\Pictures\bg.jpg"
            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all"
          />
          <button @click="updateBgImage" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20">
            应用
          </button>
        </div>
        <p class="text-[10px] text-slate-500 mt-3 italic">* 请使用 file:/// 前缀或反斜杠路径</p>
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
          <input
            type="text"
            v-model="webdavUrl"
            placeholder="https://dav.jianguoyun.com/dav/"
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">用户名</label>
            <input
              type="text"
              v-model="webdavUsername"
              placeholder="your@email.com"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">密码/密钥</label>
            <input
              type="password"
              v-model="webdavPassword"
              placeholder="••••••••"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <button
          @click="saveWebdavSettings"
          class="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 font-bold transition-all active:scale-95"
        >
          保存 WebDAV 配置
        </button>
      </div>
    </section>

    <!-- Version Info -->
    <div class="text-center space-y-2 pt-10">
      <div class="text-xl font-black italic tracking-tighter text-white/20">ELE READER</div>
      <p class="text-xs text-slate-600">Version 0.1.1-alpha | Build 2026.03.22</p>
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
