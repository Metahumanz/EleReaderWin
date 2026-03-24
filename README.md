# EleWinReader

一个基于 Electron + Vue 构建的高颜值、现代化桌面电子书阅读器。

## 🌟 核心特性

- **极致阅读体验**：支持沉浸式边框模式、横向翻页对齐、鼠标滚轮翻页、文字两端/底部对齐。
- **高自由度定制**：动态调整字体大小、行高、字间距、内容宽度，支持自定义背景图片与主题。
- **Legado 级同步**：支持 WebDAV 云端同步，完全兼容 **阅读 (Legado)** 的 `bookProgress` 格式。
  - **智能解析**：自动从文件名清洗书名与作者，解决对账难题。
  - **子文件夹支持**：完美对齐 Legado 默认的 `Books/` 存储路径。
  - **位置精算**：支持字符级偏移量（durChapterPos）与分页进度的无缝换算。
- **本地增强**：TXT/EPUB 智能章节拆分、正则内容替换、全文搜索。
- **多端适配设计**：内置多种窗口比例预设，支持右键文字选择复制。

## 🛠️ 技术栈

- **Frontend**: Vue 3 + Tailwind CSS + Vite
- **Backend**: Electron + better-sqlite3
- **Database**: SQLite
- **UI Components**: 自定义高保真组件，支持毛玻璃特效与流畅动画。

## 🚀 快速开始

### 依赖环境
- Node.js (LTS)

### 运行开发版
```bash
npm install
npm run dev
```

### 构建安装包
```bash
npm run electron:build
```

## 📜 许可证

MIT License
