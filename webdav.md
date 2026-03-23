# WebDAV 存储逻辑文档

本文档摘录了项目（Legado/阅读）中关于 WebDAV 存储本地 `.txt` 和 `.epub` 书籍的相关逻辑、内容、代码及 API 形式。

## 1. 存储逻辑概述

WebDAV 在本项目中主要用于：
- **书籍备份与导出**：将本地书籍（包括 `.txt`, `.epub` 等）上传到 WebDAV 服务器的 `books/` 目录下。
- **阅读进度同步**：将书籍的阅读进度以 JSON 格式存储在 `bookProgress/` 目录下。
- **远程书籍管理**：允许用户直接从 WebDAV 目录导入书籍到本地书架。

### 核心流程
1. **初始化**：在 `AppWebDav` 中配置服务器地址、账号和密码，并自动创建必要的远程目录（`books/`, `bookProgress/`, `background/`）。
2. **导出/上传**：
   - 使用 `RemoteBookWebDav.upload(book)` 将本地书籍文件上传。
   - 路径规则：`{rootWebDavUrl}books/{fileName}`。
3. **下载/导入**：
   - 使用 `RemoteBookWebDav.downloadRemoteBook(remoteBook)` 下载文件到本地。
   - 使用 `LocalBook.saveBookFile` 将流保存到 Android 的存储分区（Scoped Storage）。
4. **进度同步**：
   - 上传：`AppWebDav.uploadBookProgress` 将 `BookProgress` 对象转为 JSON 并上传。
   - 下载：`AppWebDav.getBookProgress` 获取远程 JSON 并更新本地数据库。

## 2. 存储内容说明

| 内容类型 | 存储路径 (相对 WebDAV 根目录) | 文件格式 | 说明 |
| :--- | :--- | :--- | :--- |
| **书籍文件** | `books/` | `.txt`, `.epub`, `.pdf` 等 | 原始书籍文件 |
| **阅读进度** | `bookProgress/` | `.json` | 格式为 `{书名}_{作者}.json` |
| **背景图片** | `background/` | 图像格式 | 导出/备份的阅读背景 |
| **全量备份** | 根目录 | `.zip` | 项目配置、书源、设置等全量包 |

### 进度 JSON 示例
```json
{
  "name": "书籍名称",
  "author": "作者",
  "durChapterIndex": 10,
  "durChapterPos": 500,
  "durChapterTitle": "第十一章",
  "durChapterTime": 1627000000000
}
```

## 3. 核心实现代码

### WebDAV 基础操作 (`WebDav.kt`)
负责底层的 HTTP 请求封装。

```kotlin
// 上传文件示例
suspend fun upload(file: File, contentType: String = DEFAULT_CONTENT_TYPE) {
    withContext(IO) {
        val fileBody = file.asRequestBody(contentType.toMediaType())
        webDavClient.newCallResponse {
            url(httpUrl)
            put(fileBody) // 使用 PUT 方法
        }.use { checkResult(it) }
    }
}
```

### 书籍上传逻辑 (`RemoteBookWebDav.kt`)
```kotlin
override suspend fun upload(book: Book) {
    val localBookUri = Uri.parse(book.bookUrl)
    val putUrl = "$rootBookUrl${book.originName}"
    val webDav = WebDav(putUrl, authorization)
    if (localBookUri.isContentScheme()) {
        webDav.upload(localBookUri)
    } else {
        webDav.upload(localBookUri.path!!)
    }
    // 更新书籍来源标记为 WebDAV
    book.origin = BookType.webDavTag + CustomUrl(putUrl).toString()
    book.update()
}
```

### 进度上传逻辑 (`AppWebDav.kt`)
```kotlin
suspend fun uploadBookProgress(book: Book) {
    val bookProgress = BookProgress(book)
    val json = GSON.toJson(bookProgress)
    val url = getProgressUrl(book.name, book.author)
    WebDav(url, authorization).upload(json.toByteArray(), "application/json")
}
```

## 4. WebDAV API 形式

项目通过以下标准 WebDAV 方法与服务器通信：

- **`PROPFIND`**: 用于获取文件/目录列表、获取文件大小及最后修改时间。
  - `Depth: 0`: 获取当前文件信息。
  - `Depth: 1`: 获取目录下级列表。
- **`MKCOL`**: 用于创建远程目录（如 `books/`, `bookProgress/`）。
- **`PUT`**: 用于上传书籍文件或进度 JSON。
- **`GET`**: 用于下载书籍或获取进度数据。
- **`DELETE`**: 用于删除远程文件。

### 认证方式
- **Basic Auth**: 使用 `Authorization: Basic {Base64(user:pass)}` 请求头。
