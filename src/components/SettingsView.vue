<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'back'): void
}>()

interface Setting {
  key: string
  value: string
}

const fontSize = ref(16)
const lineHeight = ref(1.8)
const fontFamily = ref('serif')
const webdavUrl = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')

const loadSettings = async () => {
  try {
    const result = await window.electronAPI.db.query('SELECT * FROM settings')
    const settings = result as Setting[]

    for (const setting of settings) {
      switch (setting.key) {
        case 'fontSize':
          fontSize.value = parseInt(setting.value) || 16
          break
        case 'lineHeight':
          lineHeight.value = parseFloat(setting.value) || 1.8
          break
        case 'fontFamily':
          fontFamily.value = setting.value || 'serif'
          break
        case 'webdavUrl':
          webdavUrl.value = setting.value || ''
          break
        case 'webdavUsername':
          webdavUsername.value = setting.value || ''
          break
        case 'webdavPassword':
          webdavPassword.value = setting.value || ''
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

const updateFontSize = async (e: Event) => {
  const target = e.target as HTMLInputElement
  fontSize.value = parseInt(target.value)
  await saveSetting('fontSize', target.value)
}

const updateLineHeight = async (e: Event) => {
  const target = e.target as HTMLInputElement
  lineHeight.value = parseFloat(target.value)
  await saveSetting('lineHeight', target.value)
}

const updateFontFamily = async (e: Event) => {
  const target = e.target as HTMLSelectElement
  fontFamily.value = target.value
  await saveSetting('fontFamily', target.value)
}

const saveWebdavSettings = async () => {
  await saveSetting('webdavUrl', webdavUrl.value)
  await saveSetting('webdavUsername', webdavUsername.value)
  await saveSetting('webdavPassword', webdavPassword.value)
  alert('WebDAV 设置已保存')
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="p-6">
    <div class="flex items-center mb-6">
      <button
        @click="emit('back')"
        class="mr-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
      >
        ← 返回
      </button>
      <h2 class="text-2xl font-bold">设置</h2>
    </div>

    <div class="max-w-2xl space-y-8">
      <!-- Reading Settings -->
      <section class="bg-slate-800 rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4">阅读设置</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">字体大小: {{ fontSize }}px</label>
            <input
              type="range"
              min="12"
              max="32"
              :value="fontSize"
              @input="updateFontSize"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">行高: {{ lineHeight }}</label>
            <input
              type="range"
              min="1.2"
              max="3"
              step="0.1"
              :value="lineHeight"
              @input="updateLineHeight"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">字体</label>
            <select
              :value="fontFamily"
              @change="updateFontFamily"
              class="w-full bg-slate-700 rounded-lg px-4 py-2"
            >
              <option value="serif">衬线体</option>
              <option value="sans-serif">无衬线体</option>
              <option value="monospace">等宽字体</option>
            </select>
          </div>
        </div>
      </section>

      <!-- WebDAV Settings -->
      <section class="bg-slate-800 rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4">WebDAV 同步</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">服务器地址</label>
            <input
              type="text"
              v-model="webdavUrl"
              placeholder="https://dav.jianguoyun.com/dav/"
              class="w-full bg-slate-700 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">用户名</label>
            <input
              type="text"
              v-model="webdavUsername"
              placeholder="your@email.com"
              class="w-full bg-slate-700 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">密码/应用密钥</label>
            <input
              type="password"
              v-model="webdavPassword"
              placeholder="••••••••"
              class="w-full bg-slate-700 rounded-lg px-4 py-2"
            />
          </div>

          <button
            @click="saveWebdavSettings"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            保存 WebDAV 设置
          </button>
        </div>
      </section>

      <!-- About -->
      <section class="bg-slate-800 rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4">关于</h3>
        <p class="text-slate-400">EleWinReader v0.1.0</p>
        <p class="text-slate-400 text-sm mt-2">基于 Electron + Vue 构建的桌面阅读器</p>
      </section>
    </div>
  </div>
</template>
