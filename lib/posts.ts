// FILE: lib/posts.ts

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { remark } from "remark"
import html from "remark-html"
// ❌ ایمپورت kv را اینجا نیاز نداریم چون نباید در بیلد استاتیک استفاده شود
// اگر جای دیگری استفاده می‌کنید بگذارید بماند، اما در توابع زیر استفاده نکنید.
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

// 🟢 ۱. تابع دریافت پست‌های لوکال (امن برای generateStaticParams)
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
        views: 0 // در بیلد استاتیک بازدید همیشه ۰ است
      }
    })
    .filter((post): post is Post => post !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return posts
}

// 🟠 ۲. تابع دریافت همه پست‌ها
// نکته: اگر صفحه اصلی وبلاگ (/blog) شما هم استاتیک است،
// بهتر است اینجا هم kv را حذف کنید یا آن صفحه را dynamic کنید.
// اما برای رفع ارور فعلی، فعلا می‌گذاریم این تابع کارش را بکند
// مگر اینکه در بیلد صفحه اصلی هم به مشکل بخورید.
export async function getAllPosts(): Promise<Post[]> {
  const posts = getLocalPosts()
  if (posts.length === 0) return []

  // ⚠️ نکته مهم: اگر در صفحه اصلی ارور مشابه گرفتید، کد داخل try/catch را حذف کنید
  // و فقط posts را برگردانید.
  try {
    const slugs = posts.map(p => p.slug)
    const allViews = await kv.hmget<Record<string, number>>("views", ...slugs)

    return posts.map(post => ({
      ...post,
      views: allViews?.[post.slug] || 0
    }))
  } catch (error) {
    console.error("Error fetching views form KV:", error)
    return posts
  }
}

// 🔵 ۳. دریافت تک پست (اصلاح شده برای رفع ارور)
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

    // ⭐️ اصلاح مهم: حذف فچ کردن بازدیدها از اینجا
    // چون این تابع در زمان Build اجرا می‌شود، نباید به دیتابیس وصل شود.
    // بازدید را باید در کلاینت نمایش دهید.
    const views = 0

    return {
      slug,
      contentHtml,
      views, // مقدار صفر برمی‌گرداند (درست است)
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
