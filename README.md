# EleWinReader

一个基于 Electron + Vue 构建的高颜值、现代化桌面电子书阅读器。

## 🌟 核心特性

- **极致阅读体验**：支持沉浸式边框模式、横向翻页对齐、鼠标滚轮翻页。
- **高自由度定制**：动态调整字体大小、行高、字间距、内容宽度，支持自定义背景图片。
- **本地与同步**：支持本地 TXT/EPUB 导入（智能章节拆分）、WebDAV 云端同步（支持进度与书架同步）。
- **多端适配设计**：内置多种窗口比例预设（16:9, 9:16, 4:3, 3:4），完美适配各种桌面阅读场景。
- **极简无广告**：回归纯粹的阅读体验，无干扰、无追踪，专注于本地文件解析。

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
