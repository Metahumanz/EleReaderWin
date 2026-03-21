import * as fs from 'fs'
import * as iconv from 'iconv-lite'
import * as jschardet from 'jschardet'

export interface Chapter {
  title: string
  body: string
  orderIndex: number
}

export function parseTxt(filePath: string): Chapter[] {
  const buffer = fs.readFileSync(filePath)

  const detected = jschardet.detect(buffer)
  const encoding = detected.encoding || 'UTF-8'

  let content: string
  try {
    content = iconv.decode(buffer, encoding)
  } catch {
    content = iconv.decode(buffer, 'GB18030')
  }

  const chapterRegex = /^[ \t]*(第[0-9一二三四五六七八九十百千万零两\s]+[章节回]|[Cc]hapter\s+\d+).*$/gm

  const matches: { index: number; title: string }[] = []
  let match: RegExpExecArray | null

  while ((match = chapterRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      title: match[0].trim()
    })
  }

  if (matches.length === 0) {
    return [{
      title: '全文',
      body: content.replace(/\n/g, '<br/>'),
      orderIndex: 0
    }]
  }

  const chapters: Chapter[] = []
  let lastIndex = 0

  for (let i = 0; i < matches.length; i++) {
    const { index, title } = matches[i]
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length

    const chunk = content.slice(lastIndex, index).trim()
    if (chunk.length > 0 || i === 0) {
      chapters.push({
        title: chapters.length === 0 ? '序章' : title,
        body: (chapters.length === 0 ? chunk : content.slice(index, nextIndex).replace(title, '').trim()).replace(/\n/g, '<br/>'),
        orderIndex: chapters.length
      })
    }

    lastIndex = index
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim()
    if (remaining.length > 0) {
      const lastTitle = matches[matches.length - 1]?.title || '未完待续'
      chapters.push({
        title: lastTitle,
        body: remaining.replace(lastTitle, '').trim().replace(/\n/g, '<br/>'),
        orderIndex: chapters.length
      })
    }
  }

  return chapters
}

export async function parseEpub(filePath: string): Promise<Chapter[]> {
  const epubModule = await import('epubjs')
  const Epub = typeof epubModule === 'function' ? epubModule : (epubModule as any).default
  if (typeof Epub !== 'function') {
    throw new Error('Failed to import epubjs: default export is not a function')
  }
  const book = Epub(filePath)

  await book.ready

  const toc = book.navigation.toc
  const chapters: Chapter[] = []

  for (let i = 0; i < toc.length; i++) {
    const item = toc[i]
    try {
      const spineItem = book.spine.get(item.href)
      if (!spineItem) continue

      const content = await spineItem.load(book.load.bind(book))
      const text = content?.querySelector('body')?.innerHTML || ''

      chapters.push({
        title: item.label.trim() || `第 ${i + 1} 章`,
        body: text,
        orderIndex: i
      })
    } catch (err) {
      console.error(`Failed to load chapter: ${item.href}`, err)
    }
  }

  if (chapters.length === 0) {
    const sections = book.spine.items
    for (let i = 0; i < sections.length; i++) {
      try {
        const section = sections[i]
        const content = await section.load(book.load.bind(book))
        const text = content?.querySelector('body')?.innerHTML || ''

        if (text.trim().length > 0) {
          chapters.push({
            title: `第 ${i + 1} 章`,
            body: text,
            orderIndex: i
          })
        }
      } catch (err) {
        console.error(`Failed to load spine item ${i}`, err)
      }
    }
  }

  book.destroy()

  return chapters
}
