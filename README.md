# EleWinReader

> 一个基于 Windows 11 Fluent Design (WinUI 3) 哲学构建的极致桌面阅读器。

EleWinReader 不仅仅是一个电子书阅读器，它是美学、速度与深度同步的完美融合。我们采用了 Windows 11 原生的 **Mica (云母)** 材质，为您带来最具系统沉浸感的阅读体验，同时在底层复刻了 **阅读 (Legado)** 的核心同步与解析引擎，让您的阅读跨越设备，永不断连。

## ✨ 视觉盛宴：原生云母与流体设计

*   **伪 3D 卷层翻阅 (Curl Flip)**：首创 CSS 斜向视口映射裁切与旋角阴影，在多列原生文字流下完美渲染模拟物理纸张翻折卷角的逼真效果。
*   **深层触控适配 (Touch & Swipe)**：针对具备触控的 Windows 设备优化，支持全局左右 Swipe 侧滑返回，阅读界面更设有专门的防抖防缩放控制，以及专为人性化体验打造的 9 宫格单手点击交互布局。
*   **原生云母与置顶控制 (Native Mica)**：窗口底漆穿透至系统桌面，呈现发丝级变化，并且随时可通过阅读器的置顶胶囊一键悬浮于所有窗口之上。
*   **沉浸式隐藏边框与流动侧栏**：完美融合 Windows 无边框体验，让阅读内容彻底主导屏幕。

## ⚙️ 核心战力：Legado 级深度对齐

*   **WebDAV 毫秒级同步**：完全兼容 Legado 的 `bookProgress` 格式及 `durChapterPos` 位移，实现跨端无缝接力。
*   **智能分章算法**：内置三向正则探测集，完美捕获“卷X”、“第X卷”等复杂标题，章节对齐成功率极高。
*   **全能排版实验室**：
    *   **实时预览窗**：同步映射真实阅读背景与主题设定。
    *   **精细控制**：涵盖字号、行高、段前/后间距、首行缩进等 10+ 项核心排版参数。
*   **多态书架大厅**：支持网格平铺、直列清单、大图图标三种视图，配合毫秒级瞬时搜索过滤。

## 🛠️ 技术底座

*   **Frontend**: Vue 3 + Tailwind CSS + Vite
*   **Hydration**: Electron + better-sqlite3 + Windows nativeTheme API
*   **Storage**: SQLite 3 高性能本地数据库

## 🚀 快速起航

1.  **克隆仓库**
    ```bash
    git clone https://github.com/Metahumanz/EleReaderWin.git
    ```
2.  **安装依赖**
    ```bash
    npm install
    ```
3.  **启动开发环境**
    ```bash
    npm run dev
    ```
4.  **构建生产版本**
    ```bash
    npm run build
    ```

## 📜 开源协议

MIT License. 欢迎提交 PR 或 Issue 进行交流。
