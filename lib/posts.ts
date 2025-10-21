// FILE: lib/posts.ts

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { remark } from "remark"
import html from "remark-html"
import { kv } from "@vercel/kv"

const postsDirectory = path.join(process.cwd(), "_posts")

// اینترفیس‌ها بدون تغییر
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

// ⭐️ تابع getAllPosts اصلاح شده برای خواندن از HASH
export async function getAllPosts(): Promise<Post[]> {
  const fileNames = fs.readdirSync(postsDirectory)

  // ۱. دیتای استاتیک از مارک‌داون خوانده می‌شود
  const postsFromMarkdown = fileNames
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
        category: (matterResult.data.category as string) || ""
      }
    })
    .filter((post): post is Omit<Post, "views"> => post !== null)

  // ۲. حالا تمام اسلاگ‌ها را برای کوئری زدن آماده می‌کنیم
  const slugs = postsFromMarkdown.map(p => p.slug)
  if (slugs.length === 0) {
    return [] // اگر پستی نبود، آرایه خالی برگردان
  }

  // ۳. ⭐️ "hmget" یک آبجکت برمی‌گرداند (نه آرایه) و ممکن است null باشد
  const allViews = await kv.hmget<Record<string, number>>("views", ...slugs)

  // ۴. دیتای مارک‌داون و KV را ترکیب می‌کنیم
  const allPostsData: Post[] = postsFromMarkdown
    .map(post => {
      // ⭐️ حالا به جای ایندکس، از اسلاگ برای پیدا کردن بازدید استفاده می‌کنیم
      // و حالت null بودن allViews را هم مدیریت می‌کنیم
      const views = allViews?.[post.slug] || 0
      return {
        ...post,
        views
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return allPostsData
}

// ⭐️ تابع getPostBySlug اصلاح شده برای خواندن از HASH
export async function getPostBySlug(slug: string): Promise<PostFull | null> {
  const fullPath = path.join(postsDirectory, `${slug}.md`)
  try {
    if (!fs.existsSync(fullPath)) return null
    const fileContents = fs.readFileSync(fullPath, "utf8")
    const matterResult = matter(fileContents)
    const processedContent = await remark()
      .use(html)
      .process(matterResult.content)
    const contentHtml = processedContent.toString()

    // ⭐️ به جای "get"، از "hget" برای خواندن یک فیلد از HASH استفاده می‌کنیم
    const views = (await kv.hget<number>("views", slug)) || 0

    return {
      slug,
      contentHtml,
      views, // ⭐️ بازدید واقعی از KV
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
