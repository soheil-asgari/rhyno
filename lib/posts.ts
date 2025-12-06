// FILE: lib/posts.ts

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { remark } from "remark"
import html from "remark-html"
import { kv } from "@vercel/kv"

const postsDirectory = path.join(process.cwd(), "_posts")

export interface Post {
  slug: string
  title: string
  date: string
  author: string
  image: string
  excerpt: string
  category: string
  views: number
}

export interface PostFull extends Post {
  contentHtml: string
}

// 🟢 ۱. تابع جدید: فقط خواندن فایل‌ها (بدون اتصال به دیتابیس)
// این تابع امن برای استفاده در generateStaticParams است
export function getLocalPosts(): Post[] {
  const fileNames = fs.readdirSync(postsDirectory)

  const posts = fileNames
    .map(fileName => {
      if (!fileName.endsWith(".md")) return null
      const slug = fileName.replace(/\.md$/, "")
      const fullPath = path.join(postsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, "utf8")
      const matterResult = matter(fileContents)

      return {
        slug,
        title: (matterResult.data.title as string) || "بدون عنوان",
        date: (matterResult.data.date as string) || new Date().toISOString(),
        author: (matterResult.data.author as string) || "RhynoAI",
        image: (matterResult.data.image as string) || "",
        excerpt: (matterResult.data.excerpt as string) || "",
        category: (matterResult.data.category as string) || "",
        views: 0 // مقدار پیش‌فرض چون اینجا به دیتابیس وصل نمی‌شویم
      }
    })
    .filter((post): post is Post => post !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return posts
}

// 🟠 ۲. تابع اصلی: دریافت پست‌ها + بازدیدها (برای استفاده در صفحات اصلی)
export async function getAllPosts(): Promise<Post[]> {
  // اول پست‌های لوکال را می‌گیریم
  const posts = getLocalPosts()

  if (posts.length === 0) return []

  const slugs = posts.map(p => p.slug)

  try {
    // تلاش برای گرفتن بازدیدها
    const allViews = await kv.hmget<Record<string, number>>("views", ...slugs)

    // ترکیب بازدیدها با پست‌ها
    return posts.map(post => ({
      ...post,
      views: allViews?.[post.slug] || 0
    }))
  } catch (error) {
    // اگر دیتابیس خطا داد، همان پست‌های لوکال را بدون بازدید برگردان
    console.error("Error fetching views form KV:", error)
    return posts
  }
}

// 🔵 ۳. دریافت تک پست (همراه با مدیریت خطا برای KV)
export async function getPostBySlug(slug: string): Promise<PostFull | null> {
  const fullPath = path.join(postsDirectory, `${slug}.md`)
  try {
    if (!fs.existsSync(fullPath)) return null
    const fileContents = fs.readFileSync(fullPath, "utf8")
    const matterResult = matter(fileContents)

    // پردازش محتوا
    const processedContent = await remark()
      .use(html)
      .process(matterResult.content)
    const contentHtml = processedContent.toString()

    // گرفتن بازدید (با try-catch جداگانه که کل صفحه کرش نکند)
    let views = 0
    try {
      views = (await kv.hget<number>("views", slug)) || 0
    } catch (e) {
      console.warn(`Could not fetch views for ${slug}`, e)
    }

    return {
      slug,
      contentHtml,
      views,
      title: (matterResult.data.title as string) || "بدون عنوان",
      date: (matterResult.data.date as string) || new Date().toISOString(),
      author: (matterResult.data.author as string) || "RhynoAI",
      image: (matterResult.data.image as string) || "",
      excerpt: (matterResult.data.excerpt as string) || "",
      category: (matterResult.data.category as string) || ""
    }
  } catch (error) {
    console.error(`Error processing post ${slug}:`, error)
    return null
  }
}
