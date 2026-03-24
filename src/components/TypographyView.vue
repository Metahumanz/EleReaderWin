<script setup lang="ts">
import { ref, onMounted } from 'vue'

const fontSize = ref(18)
const lineHeight = ref(1.8)
const pIndent = ref(2)
const pSpacing = ref(0.8)

const saveTypography = async () => {
    await window.electronAPI.db.query("INSERT OR REPLACE INTO settings (key, value) VALUES ('fontSize', ?)", [fontSize.value.toString()])
    await window.electronAPI.db.query("INSERT OR REPLACE INTO settings (key, value) VALUES ('lineHeight', ?)", [lineHeight.value.toString()])
    await window.electronAPI.db.query("INSERT OR REPLACE INTO settings (key, value) VALUES ('pIndent', ?)", [pIndent.value.toString()])
    await window.electronAPI.db.query("INSERT OR REPLACE INTO settings (key, value) VALUES ('pSpacing', ?)", [pSpacing.value.toString()])
}

onMounted(async () => {
    try {
        const s = await window.electronAPI.db.query("SELECT * FROM settings WHERE key IN ('fontSize', 'lineHeight', 'pIndent', 'pSpacing')")
        for (const row of s as any[]) {
            if (row.key === 'fontSize') fontSize.value = Number(row.value)
            if (row.key === 'lineHeight') lineHeight.value = Number(row.value)
            if (row.key === 'pIndent') pIndent.value = Number(row.value)
            if (row.key === 'pSpacing') pSpacing.value = Number(row.value)
        }
    } catch {}
})
</script>

<template>
  <div class="pt-2 pb-20">
    <div class="mb-10 px-1">
      <h2 class="text-[22px] font-semibold text-white/90 tracking-wide">排版与预览</h2>
      <p class="text-white/50 text-[13px] mt-1">全局控制阅读内核的文字间距、缩进等视觉排版</p>
    </div>

    <!-- Preview Box -->
    <div class="mb-8">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">阅读引擎实时效果映射</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm p-10 overflow-hidden relative">
         <div class="relative z-10 prose prose-invert mx-auto break-words text-white/90"
              :style="{ 
                fontSize: fontSize + 'px', 
                '--line-height': lineHeight, 
                '--p-indent': pIndent + 'em', 
                '--p-spacing': pSpacing + 'em' 
              }">
            <h1 class="text-center font-bold mb-10 text-white/70" :style="{ fontSize: (fontSize * 1.4) + 'px' }">第一章 深渊的呼唤</h1>
            <p>随着一阵白光闪过，这片死寂的空间里突然多出了几分鲜活的生气。他睁开眼睛，环顾四周，这不仅仅是单纯视觉的反馈，那股厚重潮湿的空气顺着鼻腔直达肺部。</p>
            <p>“就是这里了吗？”他低声喃喃自语，目光落在了远处那座隐约可见的轮廓上。那是一座高塔，直入云霄，仿佛要刺破这令人窒息的天穹。</p>
            <p>排版，是电子阅读体验的至高灵魂。优秀的字阶、充裕的行高以及恰到好处的缩进，能够最大程度地降低读者的视觉疲劳。通过这套流式布局渲染管线，您将在漫长的阅读旅途中，留存下最纯粹的乐趣。</p>
         </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="mb-8">
      <h3 class="text-[14px] font-semibold text-white/80 mb-3 px-1">基础参数控制盘</h3>
      <div class="bg-[#2d2d2d] rounded-xl border border-white/[0.06] shadow-sm divide-y divide-white/[0.04]">
         
         <!-- Font Size -->
         <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">A</span>
            <div class="flex-1 w-full max-w-md">
              <div class="text-[14px] font-medium text-white/90 flex justify-between">
                <span>全局正文字号 (Font Size)</span>
                <span class="text-emerald-400 font-mono">{{ fontSize }}px</span>
              </div>
              <input type="range" v-model="fontSize" min="12" max="36" step="1" @change="saveTypography" class="w-full mt-3 h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-[#005fb8]" />
            </div>
          </div>
         </div>

         <!-- Line Height -->
         <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">↕</span>
            <div class="flex-1 w-full max-w-md">
              <div class="text-[14px] font-medium text-white/90 flex justify-between">
                <span>全局行高比例 (Line Height)</span>
                <span class="text-emerald-400 font-mono">{{ lineHeight.toFixed(1) }}</span>
              </div>
              <input type="range" v-model="lineHeight" min="1.0" max="3.0" step="0.1" @change="saveTypography" class="w-full mt-3 h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-[#005fb8]" />
            </div>
          </div>
         </div>

         <!-- Paragraph Indent -->
         <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">⇥</span>
            <div class="flex-1 w-full max-w-md">
              <div class="text-[14px] font-medium text-white/90 flex justify-between">
                <span>首行缩进 (字符宽)</span>
                <span class="text-emerald-400 font-mono">{{ pIndent }}em</span>
              </div>
              <input type="range" v-model="pIndent" min="0" max="4" step="0.5" @change="saveTypography" class="w-full mt-3 h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-[#005fb8]" />
            </div>
          </div>
         </div>

         <!-- Paragraph Spacing -->
         <div class="p-4 hover:bg-white/[0.01] transition-colors">
          <div class="flex items-start gap-4">
            <span class="text-xl opacity-80 mt-0.5">⤓</span>
            <div class="flex-1 w-full max-w-md">
              <div class="text-[14px] font-medium text-white/90 flex justify-between">
                <span>段落末间距 (Bottom Spacing)</span>
                <span class="text-emerald-400 font-mono">{{ pSpacing.toFixed(1) }}em</span>
              </div>
              <input type="range" v-model="pSpacing" min="0" max="3" step="0.1" @change="saveTypography" class="w-full mt-3 h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-[#005fb8]" />
            </div>
          </div>
         </div>

      </div>
    </div>

  </div>
</template>
