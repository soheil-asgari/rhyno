// lib/posts.ts
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { remark } from "remark"
import html from "remark-html"

const postsDirectory = path.join(process.cwd(), "_posts")
// lib/posts.ts یا جایی که getAllPosts هست
export interface Post {
  slug: string
  title: string
  date: string
  author: string
  image: string
  excerpt: string
  category: string
}

// این تابع فقط خلاصه‌ای از اطلاعات هر پست را برای صفحه اصلی بلاگ برمی‌گرداند
export function getAllPosts(): Post[] {
  const fileNames = fs.readdirSync(postsDirectory)
  const allPostsData: Post[] = fileNames.map(fileName => {
    const slug = fileName.replace(/\.md$/, "")
    const fullPath = path.join(postsDirectory, fileName)
    const fileContents = fs.readFileSync(fullPath, "utf8")
    const matterResult = matter(fileContents)

    // fallback برای همه فیلدها
    const title = (matterResult.data.title as string) || "بدون عنوان"
    const date = (matterResult.data.date as string) || new Date().toISOString()
    const author = (matterResult.data.author as string) || "RhynoAI"
    const image = (matterResult.data.image as string) || ""
    const excerpt = (matterResult.data.excerpt as string) || ""
    const category = (matterResult.data.category as string) || ""

    return {
      slug,
      title,
      date,
      author,
      image,
      excerpt,
      category
    }
  })

  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ⭐️ مشکل اینجا بود! این تابع باید محتوای کامل یک پست را به همراه HTML برگرداند
export async function getPostBySlug(slug: string) {
  const fullPath = path.join(postsDirectory, `${slug}.md`)
  const fileContents = fs.readFileSync(fullPath, "utf8")

  const matterResult = matter(fileContents)

  const processedContent = await remark()
    .use(html)
    .process(matterResult.content)
  const contentHtml = processedContent.toString()

  // 🔹 محاسبه title با fallback
  let title = (matterResult.data.title as string) || ""
  if (!title) {
    const firstLine = matterResult.content
      .split("\n")
      .find(line => line.startsWith("# "))
    title = firstLine ? firstLine.replace(/^# /, "").trim() : "بدون عنوان"
  }

  return {
    slug,
    contentHtml,
    title, // حالا این درست کار می‌کند
    date: matterResult.data.date || new Date().toISOString(),
    author: matterResult.data.author || "RhynoAI",
    image: matterResult.data.image || "",
    excerpt: matterResult.data.excerpt || "",
    category: matterResult.data.category || ""
  }
}
