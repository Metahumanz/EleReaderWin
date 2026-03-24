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
const nextKeys = ref<string[]>(['ArrowRight', 'PageDown', ' '])
const prevKeys = ref<string[]>(['ArrowLeft', 'PageUp'])
const appVersion = ref('')
const updateStatus = ref('')
const updateDetail = ref('')
const updateAvailable = ref(false)
const updateReady = ref(false)
const autoOpenLastRead = ref(false)

const webdavUrl = ref('')
const webdavDir = ref('Books')
const webdavUser = ref('')
const webdavPass = ref('')
const webdavSync = ref(false)
const webdavTestResult = ref('')
const webdavTesting = ref(false)

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
      if (s.key === 'reader_nextKeys') { try { nextKeys.value = JSON.parse(s.value) } catch (e){} }
      if (s.key === 'reader_prevKeys') { try { prevKeys.value = JSON.parse(s.value) } catch (e){} }
      if (s.key === 'webdavUrl') webdavUrl.value = s.value
      if (s.key === 'webdavDir') webdavDir.value = s.value
      if (s.key === 'webdavUser') webdavUser.value = s.value
      if (s.key === 'webdavPass') webdavPass.value = s.value
      if (s.key === 'webdavSync') webdavSync.value = s.value === 'true'
      if (s.key === 'autoOpenLastRead') autoOpenLastRead.value = s.value === 'true'
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

const saveWebdav = async () => {
  let url = webdavUrl.value.trim()
  if (url && !url.endsWith('/')) url += '/'
  webdavUrl.value = url
  let dir = webdavDir.value.trim()
  if (dir.startsWith('/')) dir = dir.substring(1)
  if (dir && !dir.endsWith('/')) dir += '/'
  webdavDir.value = dir
  await saveSetting('webdavUrl', url)
  await saveSetting('webdavDir', dir)
  await saveSetting('webdavUser', webdavUser.value.trim())
  await saveSetting('webdavPass', webdavPass.value.trim())
  await saveSetting('webdavSync', webdavSync.value ? 'true' : 'false')
}

const testWebdav = async () => {
  if (!webdavUrl.value) { webdavTestResult.value = '❌ 请填写服务器地址'; return }
  webdavTesting.value = true
  webdavTestResult.value = '连接中...'
  await saveWebdav()
  const auth = btoa(`${webdavUser.value}:${webdavPass.value}`)
  const res = await window.electronAPI.webdav.request({
    url: webdavUrl.value, method: 'PROPFIND', headers: { 'Authorization': `Basic ${auth}`, 'Depth': '0' }
  })
  if (res.error) webdavTestResult.value = '❌ 连接异常: ' + res.error
  else if (res.status && res.status >= 200 && res.status < 300) {
    webdavTestResult.value = '✅ 连接成功！'
    // Ensure bookProgress folder inside subfolder is created
    let baseURL = webdavUrl.value
    if (webdavDir.value) baseURL += webdavDir.value
    // Create subfolder first if it's set
    if (webdavDir.value) {
      await window.electronAPI.webdav.request({
        url: baseURL, method: 'MKCOL', headers: { 'Authorization': `Basic ${auth}` }
      })
    }
    await window.electronAPI.webdav.request({
      url: baseURL + 'bookProgress/', method: 'MKCOL', headers: { 'Authorization': `Basic ${auth}` }
    })
  }
  else webdavTestResult.value = `❌失败(HTTP ${res.status}): ` + (res.data ? res.data.substring(0, 30) : '')
  webdavTesting.value = false
}

const toggleKeyHints = async () => {
  await saveSetting('hideKeyHints', (!showKeyHints.value).toString())
}

const toggleAutoOpenLastRead = async () => {
  await saveSetting('autoOpenLastRead', autoOpenLastRead.value ? 'true' : 'false')
}

const addNextKey = (e: KeyboardEvent) => {
  if (!nextKeys.value.includes(e.key) && e.key.trim().length > 0 || e.key === ' ') {
    nextKeys.value.push(e.key)
    saveSetting('reader_nextKeys', JSON.stringify(nextKeys.value))
  }
}
const removeNextKey = (k: string) => {
  nextKeys.value = nextKeys.value.filter(x => x !== k)
  saveSetting('reader_nextKeys', JSON.stringify(nextKeys.value))
}

const addPrevKey = (e: KeyboardEvent) => {
  if (!prevKeys.value.includes(e.key) && e.key.trim().length > 0 || e.key === ' ') {
    prevKeys.value.push(e.key)
    saveSetting('reader_prevKeys', JSON.stringify(prevKeys.value))
  }
}
const removePrevKey = (k: string) => {
  prevKeys.value = prevKeys.value.filter(x => x !== k)
  saveSetting('reader_prevKeys', JSON.stringify(prevKeys.value))
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
  <div class="pt-2 pb-20">
    <div class="mb-10 px-1">
      <h2 class="text-[22px] font-semibold text-white/90 tracking-wide">偏好设置</h2>
      <p class="text-white/50 text-[13px] mt-1">定制 EleWinReader 的各项核心行为与界面特质</p>
    </div>

    <!-- 1. 窗口与显示 -->
    <div class="mb-8">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">窗口与显示</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm divide-y divide-white/[0.04]">
        
        <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">🪟</span>
            <div class="flex-1">
              <div class="text-[14px] font-medium text-white/90">默认窗口比例</div>
              <div class="text-[12px] text-white/50 mt-0.5 mb-3">快速调整主阅读窗口的大小特征预设</div>
              <div class="flex flex-wrap gap-2">
                <button @click="setAspectRatio(16/9)" class="px-4 py-1.5 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/20 rounded-md text-[13px] font-mono transition-colors">16 : 9</button>
                <button @click="setAspectRatio(9/16)" class="px-4 py-1.5 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/20 rounded-md text-[13px] font-mono transition-colors">9 : 16</button>
                <button @click="setAspectRatio(4/3)" class="px-4 py-1.5 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/20 rounded-md text-[13px] font-mono transition-colors">4 : 3</button>
                <button @click="setAspectRatio(3/4)" class="px-4 py-1.5 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/20 rounded-md text-[13px] font-mono transition-colors">3 : 4</button>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">🎨</span>
            <div class="flex-1">
              <div class="text-[14px] font-medium text-white/90">跨端阅读背景壁纸</div>
              <div class="text-[12px] text-white/50 mt-0.5 mb-3">为沉浸阅读模式提供底层墙纸</div>
              
              <div class="flex gap-2 mb-3">
                <input type="text" v-model="bgImage" placeholder="在此键入图片绝对路径..." class="flex-1 bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-[13px] focus:border-[#005fb8] outline-none transition-colors" />
                <button @click="browseImage" class="px-4 py-1.5 bg-black/20 hover:bg-black/40 border border-white/5 rounded-md text-[13px] transition-colors">📂 浏览</button>
                <button @click="applyBgImage" class="px-4 py-1.5 bg-[#005fb8] hover:bg-[#005fb8]/90 text-white rounded-md text-[13px] transition-colors font-medium">应用</button>
                <button v-if="bgImage" @click="clearBgImage" class="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md text-[13px] transition-colors">清除</button>
              </div>
              
              <div v-if="bgPreview" class="relative w-full max-w-sm h-32 rounded-lg overflow-hidden border border-white/10 mt-2">
                <img :src="bgPreview" class="w-full h-full object-cover" alt="背景预览" @error="bgPreview = ''" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 2. 阅读交互 -->
    <div class="mb-8">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">阅读交互</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm divide-y divide-white/[0.04]">
        
        <div class="flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-center gap-4">
            <span class="text-xl opacity-80">💡</span>
            <div>
              <div class="text-[14px] font-medium text-white/90">显示操作浮层提示</div>
              <div class="text-[12px] text-white/50 mt-0.5">进入阅读页时屏幕底部会浮现操作引导帮助</div>
            </div>
          </div>
          <label class="flex items-center cursor-pointer relative">
            <input type="checkbox" v-model="showKeyHints" @change="toggleKeyHints" class="peer sr-only" />
            <div class="w-10 h-5 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white/80 peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005fb8] border border-white/10 peer-checked:border-[#005fb8]"></div>
          </label>
        </div>

        <div class="flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-center gap-4">
            <span class="text-xl opacity-80">🚀</span>
            <div>
              <div class="text-[14px] font-medium text-white/90">启动直达续读</div>
              <div class="text-[12px] text-white/50 mt-0.5">打开软件直接跳入上次阅读的书籍而不在书架层停留</div>
            </div>
          </div>
          <label class="flex items-center cursor-pointer relative">
            <input type="checkbox" v-model="autoOpenLastRead" @change="toggleAutoOpenLastRead" class="peer sr-only" />
            <div class="w-10 h-5 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white/80 peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005fb8] border border-white/10 peer-checked:border-[#005fb8]"></div>
          </label>
        </div>

        <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">⌨️</span>
            <div class="flex-1">
              <div class="text-[14px] font-medium text-white/90">翻页按键绑定</div>
              <div class="text-[12px] text-white/50 mt-0.5 mb-3">自定义全局控制按键组合（点击下方已绑按键可移除）</div>
              <div class="grid grid-cols-2 gap-6">
                <div>
                  <label class="block text-[12px] text-white/60 mb-2 font-medium">下一页 / 下一章绑定</label>
                  <div class="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                    <span v-for="k in nextKeys" :key="k" @click="removeNextKey(k)" class="px-2 py-0.5 bg-[#005fb8]/20 border border-[#005fb8]/30 text-[#60a5fa] rounded text-[11px] font-mono cursor-pointer hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors">
                      {{ k === ' ' ? 'Space' : k }} &times;
                    </span>
                  </div>
                  <input type="text" placeholder="按下按键录入..." @keydown.prevent="addNextKey" class="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-[12px] focus:border-[#005fb8] outline-none transition-colors" />
                </div>
                <div>
                  <label class="block text-[12px] text-white/60 mb-2 font-medium">上一页 / 上一章绑定</label>
                  <div class="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                    <span v-for="k in prevKeys" :key="k" @click="removePrevKey(k)" class="px-2 py-0.5 bg-[#005fb8]/20 border border-[#005fb8]/30 text-[#60a5fa] rounded text-[11px] font-mono cursor-pointer hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors">
                      {{ k === ' ' ? 'Space' : k }} &times;
                    </span>
                  </div>
                  <input type="text" placeholder="按下按键录入..." @keydown.prevent="addPrevKey" class="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-[12px] focus:border-[#005fb8] outline-none transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 3. WebDAV -->
    <div class="mb-8">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">云同步驱动</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm divide-y divide-white/[0.04]">
        
        <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">☁️</span>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="text-[14px] font-medium text-white/90">WebDAV 进度同步桥接</div>
                  <div class="text-[12px] text-white/50 mt-0.5">完美兼容 Legado 数据簇的终端互转</div>
                </div>
                <label class="flex items-center cursor-pointer relative">
                  <input type="checkbox" v-model="webdavSync" @change="saveWebdav" class="peer sr-only" />
                  <div class="w-10 h-5 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white/80 peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005fb8] border border-white/10 peer-checked:border-[#005fb8]"></div>
                </label>
              </div>

              <div class="space-y-3 bg-black/10 p-4 rounded-lg border border-white/5">
                <div class="grid grid-cols-[2fr_1fr] gap-3">
                  <div>
                    <label class="block text-[11px] text-white/50 mb-1">主线服务器 URL (需尾随 /)</label>
                    <input type="text" v-model="webdavUrl" @change="saveWebdav" placeholder="https://dav.jianguoyun.com/dav/" class="w-full bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-[12px] focus:border-[#005fb8] outline-none transition-colors" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-white/50 mb-1">子目录 (例如 Books)</label>
                    <input type="text" v-model="webdavDir" @change="saveWebdav" placeholder="Books" class="w-full bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-[12px] focus:border-[#005fb8] outline-none transition-colors" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] text-white/50 mb-1">认证账户 (User)</label>
                    <input type="text" v-model="webdavUser" @change="saveWebdav" placeholder="example@email.com" class="w-full bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-[12px] focus:border-[#005fb8] outline-none transition-colors" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-white/50 mb-1">连接密钥 (App Password)</label>
                    <input type="password" v-model="webdavPass" @change="saveWebdav" placeholder="••••••••" class="w-full bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-[12px] focus:border-[#005fb8] outline-none transition-colors" />
                  </div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-white/[0.05] mt-3">
                  <span class="text-[12px] min-h-[18px]" :class="webdavTestResult.includes('✅') ? 'text-emerald-400' : 'text-red-400'">{{ webdavTestResult }}</span>
                  <button @click="testWebdav" :disabled="webdavTesting" class="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-md text-[12px] transition-colors font-medium border border-white/5">探测网络</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 4. 正则清洗 -->
    <div class="mb-8">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">内容处理 (正则过滤)</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm overflow-hidden">
        <div class="p-4 border-b border-white/[0.04]">
          <div class="flex items-center justify-between mb-3">
            <p class="text-[13px] text-white/60">在阅读界面中添加用于文字净化的替换规则，在此处可以浏览并控制全部规则启用状态。</p>
            <div class="flex bg-black/20 rounded-md p-0.5 border border-white/5">
              <button @click="ruleFilter='all'" class="px-3 py-1 rounded text-[11px] font-medium transition-colors" :class="ruleFilter==='all' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'">全部</button>
              <button @click="ruleFilter='global'" class="px-3 py-1 rounded text-[11px] font-medium transition-colors" :class="ruleFilter==='global' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'">全局级</button>
              <button @click="ruleFilter='book'" class="px-3 py-1 rounded text-[11px] font-medium transition-colors" :class="ruleFilter==='book' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'">单书级</button>
            </div>
          </div>
        </div>
        
        <div v-if="filteredRules().length === 0" class="py-12 flex flex-col items-center justify-center bg-black/10">
          <span class="text-3xl opacity-30 mb-2">📝</span>
          <p class="text-[12px] text-white/40">空无一物，规则大本营闲置中</p>
        </div>

        <div v-else class="divide-y divide-white/[0.04] bg-black/10">
          <div v-for="rule in filteredRules()" :key="rule.id" class="p-3 mx-2 my-2 rounded-lg border border-transparent hover:border-white/5 hover:bg-white/[0.02] flex items-center justify-between group transition-colors" :class="rule.active ? '' : 'opacity-50'">
            <div class="flex-1 min-w-0 pr-4">
              <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <span class="text-amber-300 font-mono text-[12px] bg-amber-900/20 px-1.5 py-0.5 rounded break-all">{{ rule.pattern }}</span>
                <span class="text-white/30 text-xs">→</span>
                <span class="text-emerald-300 font-mono text-[12px] bg-emerald-900/20 px-1.5 py-0.5 rounded break-all">{{ rule.replacement || '(删除)' }}</span>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-bold px-1.5 py-[1px] rounded" :class="rule.scope === 'global' ? 'bg-purple-500/10 text-purple-400' : 'bg-sky-500/10 text-sky-400'">{{ rule.scope === 'global' ? '全局模式' : '专属模式' }}</span>
                <span v-if="rule.scope === 'book' && rule.book_id" class="text-[10px] text-white/40 max-w-[120px] truncate">#{{ getBookTitle(rule.book_id) }}</span>
                <span v-if="rule.is_regex" class="text-[10px] uppercase font-bold text-amber-400/80 px-1.5 py-[1px] bg-amber-500/10 rounded">Regex</span>
              </div>
            </div>
            
            <div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="toggleRuleActive(rule)" class="px-2.5 py-1 text-[11px] font-medium border rounded transition-colors" :class="rule.active ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' : 'border-white/20 text-white/60 hover:bg-white/10'">{{ rule.active ? '冻结' : '唤醒' }}</button>
              <button @click="deleteRule(rule.id)" class="px-2.5 py-1 text-[11px] font-medium border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors">废弃</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. 关于 -->
    <div class="mb-4">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">关于系统</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm divide-y divide-white/[0.04]">
        <div class="flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-center gap-4">
            <span class="text-xl opacity-80">🔄</span>
            <div>
              <div class="text-[14px] font-medium text-white/90">EleWinReader 更新维护</div>
              <div class="text-[12px] text-white/50 mt-0.5 mb-1" v-if="!updateStatus">版定号 v{{ appVersion }}</div>
              <div v-if="updateStatus" class="text-[12px] text-emerald-400">{{ updateStatus }} <span class="text-white/40">{{ updateDetail }}</span></div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="updateAvailable">
              <button @click="downloadUpdate" class="px-4 py-1.5 bg-[#005fb8] hover:bg-[#005fb8]/90 text-white rounded-md text-[13px] transition-colors font-medium">后台下载最新版</button>
              <button @click="openReleases" class="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[13px] transition-colors font-medium border border-white/5">前往 GitHub</button>
            </template>
            <button v-else-if="updateReady" @click="installNow" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[13px] transition-colors font-medium shadow-sm">部署并重启更新</button>
            <button v-else @click="checkForUpdate" class="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[13px] transition-colors font-medium border border-white/5">联网校验新档</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
section { animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
section:nth-child(1) { animation-delay: 0.05s; }
section:nth-child(2) { animation-delay: 0.1s; }
section:nth-child(3) { animation-delay: 0.15s; }
section:nth-child(4) { animation-delay: 0.2s; }
section:nth-child(5) { animation-delay: 0.25s; }
section:nth-child(6) { animation-delay: 0.3s; }
section:nth-child(7) { animation-delay: 0.35s; }
section:nth-child(8) { animation-delay: 0.4s; }
@keyframes slideIn { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
</style>
